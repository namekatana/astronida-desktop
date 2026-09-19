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

export type SendResult = { ok: true; message: Message } | { ok: false; message: string };

export const messageMaxLength = 2000;
export const pageSize = 50;

interface MessagePayload {
	id: string;
	channel_id: string;
	content: string;
	created_at: string;
	author: { id: string; username: string; display_name: string };
}

function fromPayload(payload: MessagePayload): Message {
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
}): Promise<{ messages: Message[]; hasMore: boolean }> {
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
	if (error || !data) return { messages: [], hasMore: false };

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

const rooms = new Map<string, PhoenixChannel>();

const sendErrors: Record<string, string> = {
	rate_limited: 'Слишком часто, подождите пару секунд',
	invalid: `Сообщение до ${messageMaxLength} символов`,
	timeout: 'Нет соединения с сервером'
};

export function sendMessage(input: { channelId: string; text: string }): Promise<SendResult> {
	const room = rooms.get(input.channelId);
	if (!room) {
		return Promise.resolve({ ok: false, message: 'Нет соединения с сервером' });
	}

	return new Promise((resolve) => {
		room
			.push('send', { content: input.text.trim() })
			.receive('ok', (payload: MessagePayload) =>
				resolve({ ok: true, message: fromPayload(payload) })
			)
			.receive('error', (reply: { reason?: string }) =>
				resolve({
					ok: false,
					message: sendErrors[reply?.reason ?? ''] ?? 'Не удалось отправить, попробуйте ещё раз'
				})
			)
			.receive('timeout', () => resolve({ ok: false, message: sendErrors.timeout }));
	});
}

const roomWaiters = new Map<string, Array<(room: PhoenixChannel) => void>>();
const roomWaitMs = 5000;

function waitForRoom(channelId: string): Promise<PhoenixChannel | null> {
	const room = rooms.get(channelId);
	if (room) return Promise.resolve(room);

	return new Promise((resolve) => {
		const waiters = roomWaiters.get(channelId) ?? [];
		const timer = setTimeout(() => {
			roomWaiters.set(
				channelId,
				(roomWaiters.get(channelId) ?? []).filter((waiter) => waiter !== settle)
			);
			resolve(null);
		}, roomWaitMs);
		const settle = (joined: PhoenixChannel) => {
			clearTimeout(timer);
			resolve(joined);
		};
		waiters.push(settle);
		roomWaiters.set(channelId, waiters);
	});
}

export type VoiceTokenResult =
	| { ok: true; value: { url: string; token: string } }
	| { ok: false; message: string };

export async function requestVoiceToken(channelId: string): Promise<VoiceTokenResult> {
	const room = await waitForRoom(channelId);
	if (!room) return { ok: false, message: 'Нет соединения с сервером' };

	return new Promise((resolve) => {
		room
			.push('voice_token', {})
			.receive('ok', (payload: { url: string; token: string }) =>
				resolve({ ok: true, value: payload })
			)
			.receive('error', () => resolve({ ok: false, message: 'Не удалось подключиться к голосу' }))
			.receive('timeout', () => resolve({ ok: false, message: sendErrors.timeout }));
	});
}

export function subscribeToChannel(input: {
	channelId: string;
	onMessage: (message: Message) => void;
	onReady: () => void;
}): () => void {
	const room = phoenixSocket().channel(`room:${input.channelId}`);
	rooms.set(input.channelId, room);
	for (const waiter of roomWaiters.get(input.channelId) ?? []) waiter(room);
	roomWaiters.delete(input.channelId);

	room.on('message', (payload: MessagePayload) => input.onMessage(fromPayload(payload)));
	room.join().receive('ok', () => input.onReady());

	return () => {
		if (rooms.get(input.channelId) === room) rooms.delete(input.channelId);
		room.leave();
	};
}
