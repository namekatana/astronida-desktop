import { history } from '$lib/history/history';
import type { Message, MessageAuthor } from './messages';

const cacheSection = 'pins';
const maxStoredChats = 100;
const persistDelayMs = 300;

interface StoredPin {
	id: string;
	author: MessageAuthor;
	text: string;
	sentAt: string;
	forwardedFrom?: { username: string };
}

const storedChats = new Map<string, Message[]>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isAuthor(value: unknown): value is MessageAuthor {
	if (!value || typeof value !== 'object') return false;
	const author = value as Record<string, unknown>;
	return (
		typeof author.id === 'string' &&
		typeof author.name === 'string' &&
		typeof author.username === 'string'
	);
}

function pinFrom(value: unknown): Message | null {
	if (!value || typeof value !== 'object') return null;
	const pin = value as Record<string, unknown>;
	if (typeof pin.id !== 'string' || typeof pin.text !== 'string') return null;
	if (typeof pin.sentAt !== 'string' || !isAuthor(pin.author)) return null;
	const sentAt = new Date(pin.sentAt);
	if (Number.isNaN(sentAt.getTime())) return null;
	const message: Message = { id: pin.id, author: pin.author, text: pin.text, sentAt };
	const forwardedFrom = pin.forwardedFrom as Record<string, unknown> | undefined;
	if (forwardedFrom && typeof forwardedFrom.username === 'string') {
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
	const raw = await history.cacheGet(cacheSection).catch(() => null);
	if (!raw) return;
	try {
		const entries: unknown = JSON.parse(raw);
		if (!Array.isArray(entries)) return;
		for (const entry of entries) {
			if (!entry || typeof entry !== 'object') continue;
			const { channelId, pins } = entry as Record<string, unknown>;
			if (typeof channelId !== 'string' || !Array.isArray(pins)) continue;
			storedChats.set(
				channelId,
				pins.map(pinFrom).filter((pin): pin is Message => pin !== null)
			);
		}
	} catch {
		return;
	}
}

function persist() {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistTimer = null;
		const entries = [...storedChats]
			.slice(-maxStoredChats)
			.map(([channelId, pins]) => ({ channelId, pins: pins.map(storedPinOf) }));
		void history.cachePut(cacheSection, JSON.stringify(entries)).catch(() => {});
	}, persistDelayMs);
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
