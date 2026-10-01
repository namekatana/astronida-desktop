import {
	fromStoredReply,
	history,
	toStoredReply,
	type OutboxRecord,
	type StoredImage
} from '$lib/history/history';
import type { CompressedImage } from '$lib/media/compress';
import { mediaStore } from '$lib/media/media-store';
import { uploadImages } from '$lib/media/upload';
import { uploadProgress, waitingForNetwork } from '$lib/media/upload-progress.svelte';
import { sendMessage, type SendResult } from './message-actions';
import type { Message, MessageReply } from './messages';
import { holdRoom } from './rooms';

export interface OutboxEntry {
	clientId: string;
	channelId: string;
	text: string;
	createdAt: Date;
	replyTo?: MessageReply;
	images: CompressedImage[];
}

interface OutboxHandlers {
	onSent: (entry: OutboxEntry, message: Message) => void;
	onRejected: (entry: OutboxEntry) => void;
}

type Uploaded = { ids: string[]; at: number };
type Prepared = { ok: true; ids: string[] } | { ok: false; retry: boolean };

const retryDelayMs = 5000;
const uploadReuseMs = 60 * 60 * 1000;
const pendingPrefix = 'pending:';

export function createEntry(
	channelId: string,
	text: string,
	replyTo: MessageReply | undefined,
	images: CompressedImage[]
): OutboxEntry {
	return { clientId: crypto.randomUUID(), channelId, text, createdAt: new Date(), replyTo, images };
}

export function pendingIdOf(entry: OutboxEntry): string {
	return `${pendingPrefix}${String(entry.createdAt.getTime()).padStart(15, '0')}:${entry.clientId}`;
}

export function clientIdOf(pendingId: string): string | null {
	if (!pendingId.startsWith(pendingPrefix)) return null;
	return pendingId.slice(pendingId.lastIndexOf(':') + 1);
}

function mediaKey(clientId: string, index: number, variant: 'feed' | 'full'): string {
	return `${clientId}-${index}-${variant}`;
}

function toStoredImage(image: CompressedImage): StoredImage {
	return { width: image.width, height: image.height, thumbHash: image.thumbHash };
}

function toRecord(entry: OutboxEntry): OutboxRecord {
	return {
		clientId: entry.clientId,
		channelId: entry.channelId,
		content: entry.text,
		createdAt: entry.createdAt.toISOString(),
		reply: toStoredReply(entry.replyTo),
		attachments: entry.images.map(toStoredImage)
	};
}

async function storeImages(entry: OutboxEntry) {
	await Promise.all(
		entry.images.flatMap((image, index) => [
			mediaStore.write('outbox', mediaKey(entry.clientId, index, 'feed'), image.feed),
			mediaStore.write('outbox', mediaKey(entry.clientId, index, 'full'), image.full)
		])
	);
}

async function restoreImages(record: OutboxRecord): Promise<CompressedImage[] | null> {
	const images: CompressedImage[] = [];
	for (const [index, stored] of (record.attachments ?? []).entries()) {
		const [feed, full] = await Promise.all([
			mediaStore.read('outbox', mediaKey(record.clientId, index, 'feed')),
			mediaStore.read('outbox', mediaKey(record.clientId, index, 'full'))
		]);
		if (!feed || !full) return null;
		images.push({ ...stored, feed, full });
	}
	return images;
}

function forgetStored(clientId: string) {
	void history.outboxRemove(clientId).catch(() => {});
	void mediaStore.remove('outbox', clientId).catch(() => {});
}

async function fromRecord(record: OutboxRecord): Promise<OutboxEntry | null> {
	const images = await restoreImages(record).catch(() => null);
	if (!images) {
		forgetStored(record.clientId);
		return null;
	}
	return {
		clientId: record.clientId,
		channelId: record.channelId,
		text: record.content,
		createdAt: new Date(record.createdAt),
		replyTo: fromStoredReply(record.reply),
		images
	};
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
	const records = await history.outboxList().catch((): OutboxRecord[] => []);
	const entries = await Promise.all(records.map(fromRecord));
	return entries.filter((entry): entry is OutboxEntry => entry !== null);
}

export function createOutbox(handlers: OutboxHandlers) {
	const queues = new Map<string, OutboxEntry[]>();
	const releases = new Map<string, () => void>();
	const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
	const draining = new Set<string>();
	const inFlight = new Set<string>();
	const cancelled = new Set<string>();
	const uploads = new Map<string, Uploaded>();
	const persisting = new Map<string, Promise<void>>();
	let closed = false;

	function queueOf(channelId: string): OutboxEntry[] {
		let queue = queues.get(channelId);
		if (!queue) {
			queue = [];
			queues.set(channelId, queue);
		}
		return queue;
	}

	function watch(channelId: string) {
		if (releases.has(channelId)) return;
		releases.set(
			channelId,
			holdRoom(channelId, () => queueMicrotask(() => void drain(channelId)))
		);
	}

	function unwatch(channelId: string) {
		releases.get(channelId)?.();
		releases.delete(channelId);
		const timer = retryTimers.get(channelId);
		if (timer) clearTimeout(timer);
		retryTimers.delete(channelId);
		queues.delete(channelId);
	}

	function scheduleRetry(channelId: string) {
		if (retryTimers.has(channelId)) return;
		retryTimers.set(
			channelId,
			setTimeout(() => {
				retryTimers.delete(channelId);
				void drain(channelId);
			}, retryDelayMs)
		);
	}

	function retryNow() {
		for (const [channelId, timer] of retryTimers) {
			clearTimeout(timer);
			retryTimers.delete(channelId);
			void drain(channelId);
		}
	}

	window.addEventListener('online', retryNow);

	function markWaiting(clientId: string) {
		uploadProgress.delete(clientId);
		waitingForNetwork.add(clientId);
	}

	function release(clientId: string) {
		const persisted = persisting.get(clientId) ?? Promise.resolve();
		persisting.delete(clientId);
		void persisted.then(() => forgetStored(clientId));
		uploads.delete(clientId);
		uploadProgress.delete(clientId);
		waitingForNetwork.delete(clientId);
	}

	function settle(entry: OutboxEntry, result: SendResult) {
		release(entry.clientId);
		const wasCancelled = cancelled.delete(entry.clientId);
		if (result.ok) handlers.onSent(entry, result.message);
		else if (!wasCancelled) handlers.onRejected(entry);
	}

	async function prepareImages(entry: OutboxEntry): Promise<Prepared> {
		if (entry.images.length === 0) return { ok: true, ids: [] };
		const previous = uploads.get(entry.clientId);
		if (previous && Date.now() - previous.at < uploadReuseMs)
			return { ok: true, ids: previous.ids };

		const result = await uploadImages(entry.channelId, entry.images, (fraction) => {
			if (cancelled.has(entry.clientId)) return;
			waitingForNetwork.delete(entry.clientId);
			uploadProgress.set(entry.clientId, fraction);
		});
		if (result.ok) uploads.set(entry.clientId, { ids: result.ids, at: Date.now() });
		return result;
	}

	async function deliver(entry: OutboxEntry): Promise<SendResult> {
		const prepared = await prepareImages(entry);
		if (!prepared.ok) return prepared;
		if (cancelled.has(entry.clientId)) return { ok: false, retry: false };
		return sendMessage({
			channelId: entry.channelId,
			clientId: entry.clientId,
			text: entry.text,
			replyToId: entry.replyTo?.id,
			attachmentIds: prepared.ids
		});
	}

	async function drain(channelId: string) {
		if (closed || draining.has(channelId)) return;
		draining.add(channelId);
		const queue = queueOf(channelId);
		try {
			while (!closed && queue.length > 0) {
				const entry = queue[0];
				inFlight.add(entry.clientId);
				const result = await deliver(entry);
				inFlight.delete(entry.clientId);
				if (closed) return;
				if (!result.ok && result.retry && !cancelled.has(entry.clientId)) {
					markWaiting(entry.clientId);
					scheduleRetry(channelId);
					return;
				}
				queue.shift();
				settle(entry, result);
			}
		} finally {
			draining.delete(channelId);
		}
		if (!closed && queue.length === 0) unwatch(channelId);
	}

	function add(entry: OutboxEntry) {
		queueOf(entry.channelId).push(entry);
		watch(entry.channelId);
		void drain(entry.channelId);
	}

	return {
		enqueue(entry: OutboxEntry) {
			if (closed) return;
			persisting.set(
				entry.clientId,
				storeImages(entry)
					.then(() => history.outboxPut(toRecord(entry)))
					.catch(() => {})
			);
			add(entry);
		},

		restore(entries: OutboxEntry[]) {
			if (closed) return;
			for (const entry of entries) add(entry);
		},

		cancel(clientId: string) {
			if (inFlight.has(clientId)) {
				cancelled.add(clientId);
				uploadProgress.delete(clientId);
				waitingForNetwork.delete(clientId);
				return;
			}
			release(clientId);
			for (const [channelId, queue] of queues) {
				const index = queue.findIndex((entry) => entry.clientId === clientId);
				if (index === -1) continue;
				queue.splice(index, 1);
				if (queue.length === 0 && !draining.has(channelId)) unwatch(channelId);
				return;
			}
		},

		close() {
			closed = true;
			window.removeEventListener('online', retryNow);
			for (const channelId of [...releases.keys()]) unwatch(channelId);
			queues.clear();
			uploadProgress.clear();
			waitingForNetwork.clear();
		}
	};
}
