import { hasVisibleContent, withoutBidiControls } from '$lib/ui/visible-text';
import type { Feeds } from './feeds.svelte';
import type { Message, MessageAuthor, MessageReply } from './messages';
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

	function pendingMessageOf(entry: OutboxEntry): Message {
		const message: Message = {
			id: pendingIdOf(entry),
			author: input.author(),
			text: entry.text,
			sentAt: entry.createdAt,
			status: 'sending'
		};
		if (entry.replyTo) message.replyTo = entry.replyTo;
		return message;
	}

	function handleSent(entry: OutboxEntry, message: Message) {
		const loaded = feeds.isLoaded(entry.channelId);
		feeds.removeMessage(entry.channelId, pendingIdOf(entry));
		if (loaded) {
			feeds.absorb(entry.channelId, [message]);
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

	function send(channelId: string, text: string, replyTo?: MessageReply) {
		const visibleText = withoutBidiControls(text).trim();
		if (!hasVisibleContent(visibleText)) return;
		const entry = createEntry(channelId, visibleText, replyTo);
		feeds.addPending(channelId, pendingMessageOf(entry));
		outbox.enqueue(entry);
	}

	function cancel(channelId: string, messageId: string) {
		const clientId = clientIdOf(messageId);
		if (!clientId) return;
		outbox.cancel(clientId);
		feeds.removeMessage(channelId, messageId);
	}

	return { send, cancel, close: outbox.close };
}
