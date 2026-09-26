import type { Channel as PhoenixChannel } from 'phoenix';
import { phoenixSocket } from '$lib/realtime/socket';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface MessageAuthor {
	id: string;
	name: string;
	username: string;
}

export interface Message {
	id: string;
	author: MessageAuthor;
	text: string;
	sentAt: Date;
	status?: 'sending' | 'failed';
}

export type SendResult = { ok: true; message: Message } | { ok: false; retry: boolean };

export const messageMaxLength = 2000;
export const pageSize = 50;

export interface MessagePayload {
	id: string;
	channel_id: string;
	content: string;
	created_at: string;
	author: { id: string; username: string; display_name: string };
}

export function fromPayload(payload: MessagePayload): Message {
	return {
		id: payload.id,
		author: {
			id: payload.author.id,
			username: payload.author.username,
			name: payload.author.display_name
		},
		text: payload.content,
		sentAt: new Date(payload.created_at)
	};
}

export async function loadMessages(input: {
	channelId: string;
	before?: string;
	after?: string;
}): Promise<{ messages: Message[]; hasMore: boolean } | null> {
	let query = supabase
		.from('messages')
		.select('id, author_id, content, created_at, profiles (username, display_name)')
		.eq('channel_id', input.channelId)
		.is('deleted_at', null)
		.order('id', { ascending: false })
		.limit(pageSize);
	if (input.before) query = query.lt('id', input.before);
	if (input.after) query = query.gt('id', input.after);

	const { data, error } = await retryOnFreshToken(() => query);
	if (error || !data) return null;

	const messages = data.map((row) => ({
		id: row.id,
		author: {
			id: row.author_id,
			username: row.profiles?.username ?? 'unknown',
			name: row.profiles?.display_name ?? '?'
		},
		text: row.content,
		sentAt: new Date(row.created_at)
	}));
	return { messages: messages.reverse(), hasMore: data.length === pageSize };
}

interface Room {
	channel: PhoenixChannel;
	users: number;
	readyListeners: Set<() => void>;
}

const rooms = new Map<string, Room>();
const retryableSendErrors = new Set(['rate_limited', 'in_progress']);

function acquireRoom(channelId: string): Room {
	const existing = rooms.get(channelId);
	if (existing) {
		existing.users += 1;
		return existing;
	}
	const room: Room = {
		channel: phoenixSocket().channel(`room:${channelId}`),
		users: 1,
		readyListeners: new Set()
	};
	room.channel.join().receive('ok', () => {
		for (const listener of room.readyListeners) listener();
	});
	rooms.set(channelId, room);
	return room;
}

function releaseRoom(channelId: string, room: Room) {
	room.users -= 1;
	if (room.users > 0) return;
	if (rooms.get(channelId) === room) rooms.delete(channelId);
	room.channel.leave();
}

function hold(channelId: string, onReady: () => void): { room: Room; release: () => void } {
	const room = acquireRoom(channelId);
	room.readyListeners.add(onReady);
	if (room.channel.state === 'joined') onReady();
	return {
		room,
		release: () => {
			room.readyListeners.delete(onReady);
			releaseRoom(channelId, room);
		}
	};
}

export function holdRoom(channelId: string, onReady: () => void): () => void {
	return hold(channelId, onReady).release;
}

export function sendMessage(input: {
	channelId: string;
	clientId: string;
	text: string;
}): Promise<SendResult> {
	const room = rooms.get(input.channelId);
	if (!room || room.channel.state !== 'joined') {
		return Promise.resolve({ ok: false, retry: true });
	}

	return new Promise((resolve) => {
		room.channel
			.push('send', { content: input.text.trim(), client_id: input.clientId })
			.receive('ok', (payload: MessagePayload) =>
				resolve({ ok: true, message: fromPayload(payload) })
			)
			.receive('error', (reply: { reason?: string }) =>
				resolve({ ok: false, retry: retryableSendErrors.has(reply?.reason ?? '') })
			)
			.receive('timeout', () => resolve({ ok: false, retry: true }));
	});
}

export function sendTyping(channelId: string) {
	rooms.get(channelId)?.channel.push('typing', {});
}

export function subscribeToChannel(input: {
	channelId: string;
	onMessage: (message: Message) => void;
	onTyping: (userId: string) => void;
	onReady: () => void;
}): () => void {
	const { room, release } = hold(input.channelId, input.onReady);
	const { channel } = room;

	const messageRef = channel.on('message', (payload: MessagePayload) =>
		input.onMessage(fromPayload(payload))
	);
	const typingRef = channel.on('typing', (payload: { user_id?: unknown }) => {
		if (typeof payload?.user_id === 'string') input.onTyping(payload.user_id);
	});

	return () => {
		channel.off('message', messageRef);
		channel.off('typing', typingRef);
		release();
	};
}
