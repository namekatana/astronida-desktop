import { createCachedSection } from '$lib/cache/cached-section';
import { asRecord } from '$lib/ui/record';
import type { Message, MessageAuthor } from './messages';

const maxStoredChats = 100;

interface StoredPin {
	id: string;
	author: MessageAuthor;
	text: string;
	sentAt: string;
	forwardedFrom?: { username: string };
}

const section = createCachedSection('pins');
const storedChats = new Map<string, Message[]>();

function authorFrom(value: unknown): MessageAuthor | null {
	const author = asRecord(value);
	if (typeof author?.id !== 'string' || typeof author.name !== 'string') return null;
	if (typeof author.username !== 'string') return null;
	return { id: author.id, name: author.name, username: author.username };
}

function pinFrom(value: unknown): Message | null {
	const pin = asRecord(value);
	if (typeof pin?.id !== 'string' || typeof pin.text !== 'string') return null;
	const author = authorFrom(pin.author);
	if (typeof pin.sentAt !== 'string' || !author) return null;
	const sentAt = new Date(pin.sentAt);
	if (Number.isNaN(sentAt.getTime())) return null;
	const message: Message = { id: pin.id, author, text: pin.text, sentAt };
	const forwardedFrom = asRecord(pin.forwardedFrom);
	if (typeof forwardedFrom?.username === 'string') {
		message.forwardedFrom = { username: forwardedFrom.username };
	}
	return message;
}

function storedPinOf(message: Message): StoredPin {
	const pin: StoredPin = {
		id: message.id,
		author: { id: message.author.id, name: message.author.name, username: message.author.username },
		text: message.text,
		sentAt: message.sentAt.toISOString()
	};
	if (message.forwardedFrom) pin.forwardedFrom = { username: message.forwardedFrom.username };
	return pin;
}

export async function restorePinned() {
	storedChats.clear();
	const entries = await section.read();
	if (!Array.isArray(entries)) return;
	for (const entry of entries) {
		const row = asRecord(entry);
		if (typeof row?.channelId !== 'string' || !Array.isArray(row.pins)) continue;
		storedChats.set(
			row.channelId,
			row.pins.map(pinFrom).filter((pin): pin is Message => pin !== null)
		);
	}
}

function persist() {
	section.persist(() =>
		[...storedChats]
			.slice(-maxStoredChats)
			.map(([channelId, pins]) => ({ channelId, pins: pins.map(storedPinOf) }))
	);
}

export function cachedPinned(channelId: string): Message[] | undefined {
	return storedChats.get(channelId);
}

export function storePinned(channelId: string, messages: Message[]) {
	storedChats.delete(channelId);
	storedChats.set(channelId, messages);
	while (storedChats.size > maxStoredChats) {
		const oldest = storedChats.keys().next().value;
		if (oldest === undefined) break;
		storedChats.delete(oldest);
	}
	persist();
}
