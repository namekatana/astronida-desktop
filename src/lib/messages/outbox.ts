import { fromStoredReply, history, toStoredReply, type OutboxRecord } from '$lib/history/history';
import { sendMessage, type SendResult } from './message-actions';
import type { Message, MessageReply } from './messages';
import { holdRoom } from './rooms';

export interface OutboxEntry {
	clientId: string;
	channelId: string;
	text: string;
	createdAt: Date;
	replyTo?: MessageReply;
}

interface OutboxHandlers {
	onSent: (entry: OutboxEntry, message: Message) => void;
	onRejected: (entry: OutboxEntry) => void;
}

const retryDelayMs = 5000;
const pendingPrefix = 'pending:';

export function createEntry(
	channelId: string,
	text: string,
	replyTo: MessageReply | undefined
): OutboxEntry {
	return { clientId: crypto.randomUUID(), channelId, text, createdAt: new Date(), replyTo };
}

export function pendingIdOf(entry: OutboxEntry): string {
	return `${pendingPrefix}${String(entry.createdAt.getTime()).padStart(15, '0')}:${entry.clientId}`;
}

export function clientIdOf(pendingId: string): string | null {
	if (!pendingId.startsWith(pendingPrefix)) return null;
	return pendingId.slice(pendingId.lastIndexOf(':') + 1);
}

function toRecord(entry: OutboxEntry): OutboxRecord {
	return {
		clientId: entry.clientId,
		channelId: entry.channelId,
		content: entry.text,
		createdAt: entry.createdAt.toISOString(),
		reply: toStoredReply(entry.replyTo)
	};
}

function fromRecord(record: OutboxRecord): OutboxEntry {
	return {
		clientId: record.clientId,
		channelId: record.channelId,
		text: record.content,
		createdAt: new Date(record.createdAt),
		replyTo: fromStoredReply(record.reply)
	};
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
	const records = await history.outboxList().catch((): OutboxRecord[] => []);
	return records.map(fromRecord);
}

export function createOutbox(handlers: OutboxHandlers) {
	const queues = new Map<string, OutboxEntry[]>();
	const releases = new Map<string, () => void>();
	const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
	const draining = new Set<string>();
	const inFlight = new Set<string>();
	const cancelled = new Set<string>();
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

	function settle(entry: OutboxEntry, result: SendResult) {
		void history.outboxRemove(entry.clientId).catch(() => {});
		const wasCancelled = cancelled.delete(entry.clientId);
		if (result.ok) handlers.onSent(entry, result.message);
		else if (!wasCancelled) handlers.onRejected(entry);
	}

	async function drain(channelId: string) {
		if (closed || draining.has(channelId)) return;
		draining.add(channelId);
		const queue = queueOf(channelId);
		try {
			while (!closed && queue.length > 0) {
				const entry = queue[0];
				inFlight.add(entry.clientId);
				const result = await sendMessage({
					channelId,
					clientId: entry.clientId,
					text: entry.text,
					replyToId: entry.replyTo?.id
				});
				inFlight.delete(entry.clientId);
				if (closed) return;
				if (!result.ok && result.retry && !cancelled.has(entry.clientId)) {
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
			void history.outboxPut(toRecord(entry)).catch(() => {});
			add(entry);
		},

		restore(entries: OutboxEntry[]) {
			if (closed) return;
			for (const entry of entries) add(entry);
		},

		cancel(clientId: string) {
			if (inFlight.has(clientId)) {
				cancelled.add(clientId);
				return;
			}
			void history.outboxRemove(clientId).catch(() => {});
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
			for (const channelId of [...releases.keys()]) unwatch(channelId);
			queues.clear();
		}
	};
}
