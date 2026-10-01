import type { CompressedImage } from '$lib/media/compress';
import { adoptSentImage } from '$lib/media/images';
import { spoilers } from '$lib/media/spoilers.svelte';
import { hasVisibleContent, withoutBidiControls } from '$lib/ui/visible-text';
import type { Feeds } from './feeds.svelte';
import type { Message, MessageAttachment, MessageAuthor, MessageReply } from './messages';
import {
	clientIdOf,
	createEntry,
	createOutbox,
	loadOutbox,
	pendingIdOf,
	type OutboxEntry
} from './outbox';

export function createSending(input: { feeds: Feeds; author: () => MessageAuthor }) {
	const { feeds } = input;
	const previewUrls = new Map<string, string[]>();

	function previewsOf(entry: OutboxEntry): string[] {
		let urls = previewUrls.get(entry.clientId);
		if (!urls) {
			urls = entry.images.map((image) => URL.createObjectURL(image.feed));
			previewUrls.set(entry.clientId, urls);
		}
		return urls;
	}

	function releasePreviews(clientId: string) {
		for (const url of previewUrls.get(clientId) ?? []) URL.revokeObjectURL(url);
		previewUrls.delete(clientId);
	}

	function pendingAttachments(entry: OutboxEntry): MessageAttachment[] {
		const urls = previewsOf(entry);
		return entry.images.map((image, index) => ({
			id: `local-${entry.clientId}-${index}`,
			channelId: entry.channelId,
			width: image.width,
			height: image.height,
			thumbHash: image.thumbHash,
			spoiler: entry.spoiler,
			localUrl: urls[index]
		}));
	}

	function pendingMessageOf(entry: OutboxEntry): Message {
		const message: Message = {
			id: pendingIdOf(entry),
			author: input.author(),
			text: entry.text,
			sentAt: entry.createdAt,
			status: 'sending'
		};
		if (entry.replyTo) message.replyTo = entry.replyTo;
		if (entry.images.length > 0) message.attachments = pendingAttachments(entry);
		return message;
	}

	function adoptImages(entry: OutboxEntry, message: Message) {
		const urls = previewUrls.get(entry.clientId) ?? [];
		previewUrls.delete(entry.clientId);
		message.attachments?.forEach((attachment, index) => {
			const image = entry.images[index];
			if (image) adoptSentImage(attachment.id, { ...image, feedUrl: urls[index] });
		});
	}

	function handleSent(entry: OutboxEntry, message: Message) {
		adoptImages(entry, message);
		const pendingId = pendingIdOf(entry);
		spoilers.carryOver(pendingId, message.id);
		feeds.removeMessage(entry.channelId, pendingId);
		if (feeds.has(entry.channelId)) {
			feeds.absorb(entry.channelId, [{ ...message, localKey: pendingId }]);
			return;
		}
		feeds.storeOnDisk(entry.channelId, message);
	}

	function handleRejected(entry: OutboxEntry) {
		feeds.markFailed(entry.channelId, pendingIdOf(entry));
	}

	const outbox = createOutbox({ onSent: handleSent, onRejected: handleRejected });

	$effect(() => {
		let active = true;
		void loadOutbox().then((entries) => {
			if (!active) return;
			for (const entry of entries) feeds.addPending(entry.channelId, pendingMessageOf(entry));
			outbox.restore(entries);
		});
		return () => {
			active = false;
			outbox.close();
		};
	});

	function send(
		channelId: string,
		text: string,
		replyTo?: MessageReply,
		images: CompressedImage[] = [],
		spoiler = false
	) {
		const visibleText = withoutBidiControls(text).trim();
		const hasText = hasVisibleContent(visibleText);
		if (!hasText && images.length === 0) return;
		const entry = createEntry(channelId, hasText ? visibleText : '', replyTo, images, spoiler);
		feeds.addPending(channelId, pendingMessageOf(entry));
		outbox.enqueue(entry);
	}

	function cancel(channelId: string, messageId: string) {
		const clientId = clientIdOf(messageId);
		if (!clientId) return;
		outbox.cancel(clientId);
		feeds.removeMessage(channelId, messageId);
		releasePreviews(clientId);
	}

	return { send, cancel, close: outbox.close };
}
