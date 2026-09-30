import type { Channel as PhoenixChannel } from 'phoenix';
import { phoenixSocket } from '$lib/realtime/socket';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface MessageAuthor {
	id: string;
	name: string;
	username: string;
}

export interface MessageReply {
	id: string;
	original: { author: MessageAuthor; text: string; forwardedFrom?: { username: string } } | null;
}

export interface Message {
	id: string;
	author: MessageAuthor;
	text: string;
	sentAt: Date;
	replyTo?: MessageReply;
	forwardedFrom?: { username: string };
	status?: 'sending' | 'failed';
}

export type SendResult = { ok: true; message: Message } | { ok: false; retry: boolean };

export const messageMaxLength = 2000;
export const pageSize = 50;

interface AuthorPayload {
	id: string;
	username: string;
	display_name: string;
}

export interface MessagePayload {
	id: string;
	channel_id: string;
	content: string;
	created_at: string;
	author: AuthorPayload;
	reply_to?: {
		id: string;
		content: string;
		author: AuthorPayload;
		forwarded_from?: { username: string } | null;
	} | null;
	forwarded_from?: { username: string } | null;
}

function authorFrom(payload: AuthorPayload): MessageAuthor {
	return { id: payload.id, username: payload.username, name: payload.display_name };
}

export function fromPayload(payload: MessagePayload): Message {
	const message: Message = {
		id: payload.id,
		author: authorFrom(payload.author),
		text: payload.content,
		sentAt: new Date(payload.created_at)
	};
	if (payload.reply_to) {
		const original: NonNullable<MessageReply['original']> = {
			author: authorFrom(payload.reply_to.author),
			text: payload.reply_to.content
		};
		if (payload.reply_to.forwarded_from) {
			original.forwardedFrom = { username: payload.reply_to.forwarded_from.username };
		}
		message.replyTo = { id: payload.reply_to.id, original };
	}
	if (payload.forwarded_from) message.forwardedFrom = { username: payload.forwarded_from.username };
	return message;
}

type ProfileRow = { username: string; display_name: string } | null;

function authorOfRow(authorId: string, profile: ProfileRow): MessageAuthor {
	return {
		id: authorId,
		username: profile?.username ?? 'unknown',
		name: profile?.display_name ?? '?'
	};
}

async function loadReplyOriginals(
	ids: string[]
): Promise<Map<string, NonNullable<MessageReply['original']>> | null> {
	const originals = new Map<string, NonNullable<MessageReply['original']>>();
	if (ids.length === 0) return originals;
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('messages')
			.select('id, author_id, content, forwarded_from_username, profiles (username, display_name)')
			.in('id', ids)
			.is('deleted_at', null)
	);
	if (error || !data) return null;
	for (const row of data) {
		const original: NonNullable<MessageReply['original']> = {
			author: authorOfRow(row.author_id, row.profiles),
			text: row.content
		};
		if (row.forwarded_from_username) {
			original.forwardedFrom = { username: row.forwarded_from_username };
		}
		originals.set(row.id, original);
	}
	return originals;
}

const messageColumns =
	'id, author_id, content, created_at, reply_to_id, forwarded_from_username, profiles (username, display_name)';

interface MessageRow {
	id: string;
	author_id: string;
	content: string;
	created_at: string;
	reply_to_id: string | null;
	forwarded_from_username: string | null;
	profiles: ProfileRow;
}

async function messagesFromRows(data: MessageRow[]): Promise<Message[] | null> {
	const replyIds = [...new Set(data.flatMap((row) => (row.reply_to_id ? [row.reply_to_id] : [])))];
	const originals = await loadReplyOriginals(replyIds);
	if (!originals) return null;

	return data.map((row) => {
		const message: Message = {
			id: row.id,
			author: authorOfRow(row.author_id, row.profiles),
			text: row.content,
			sentAt: new Date(row.created_at)
		};
		if (row.reply_to_id) {
			message.replyTo = { id: row.reply_to_id, original: originals.get(row.reply_to_id) ?? null };
		}
		if (row.forwarded_from_username) {
			message.forwardedFrom = { username: row.forwarded_from_username };
		}
		return message;
	});
}

export async function loadMessages(input: {
	channelId: string;
	before?: string;
	after?: string;
}): Promise<{ messages: Message[]; hasMore: boolean } | null> {
	let query = supabase
		.from('messages')
		.select(messageColumns)
		.eq('channel_id', input.channelId)
		.is('deleted_at', null)
		.order('id', { ascending: false })
		.limit(pageSize);
	if (input.before) query = query.lt('id', input.before);
	if (input.after) query = query.gt('id', input.after);

	const { data, error } = await retryOnFreshToken(() => query);
	if (error || !data) return null;

	const messages = await messagesFromRows(data);
	if (!messages) return null;
	return { messages: messages.reverse(), hasMore: data.length === pageSize };
}

export const pinnedMaxCount = 50;

export async function loadPinnedMessages(channelId: string): Promise<Message[] | null> {
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('messages')
			.select(messageColumns)
			.eq('channel_id', channelId)
			.eq('pinned', true)
			.is('deleted_at', null)
			.order('id', { ascending: false })
			.limit(pinnedMaxCount)
	);
	if (error || !data) return null;
	return messagesFromRows(data);
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
	replyToId?: string;
}): Promise<SendResult> {
	const room = rooms.get(input.channelId);
	if (!room || room.channel.state !== 'joined') {
		return Promise.resolve({ ok: false, retry: true });
	}

	return new Promise((resolve) => {
		room.channel
			.push('send', {
				content: input.text.trim(),
				client_id: input.clientId,
				reply_to_id: input.replyToId ?? null
			})
			.receive('ok', (payload: MessagePayload) =>
				resolve({ ok: true, message: fromPayload(payload) })
			)
			.receive('error', (reply: { reason?: string }) =>
				resolve({ ok: false, retry: retryableSendErrors.has(reply?.reason ?? '') })
			)
			.receive('timeout', () => resolve({ ok: false, retry: true }));
	});
}

export const forwardMaxTargets = 10;

export type ForwardResult =
	| { ok: true; delivered: { channelId: string; message: Message }[] }
	| { ok: false; reason: 'rate_limited' | 'failed' };

export function forwardMessage(input: {
	sourceChannelId: string;
	messageId: string;
	channelIds: string[];
	comment: string;
	clientId: string;
}): Promise<ForwardResult> {
	const room = rooms.get(input.sourceChannelId);
	if (!room || room.channel.state !== 'joined') {
		return Promise.resolve({ ok: false, reason: 'failed' });
	}

	return new Promise((resolve) => {
		room.channel
			.push('forward', {
				message_id: input.messageId,
				channel_ids: input.channelIds,
				comment: input.comment.trim() || null,
				client_id: input.clientId
			})
			.receive('ok', (reply: { messages: MessagePayload[] }) =>
				resolve({
					ok: true,
					delivered: reply.messages.map((payload) => ({
						channelId: payload.channel_id,
						message: fromPayload(payload)
					}))
				})
			)
			.receive('error', (reply: { reason?: string }) =>
				resolve({ ok: false, reason: reply?.reason === 'rate_limited' ? 'rate_limited' : 'failed' })
			)
			.receive('timeout', () => resolve({ ok: false, reason: 'failed' }));
	});
}

export type PinFailure = 'limit_reached' | 'rate_limited' | 'failed';

export function setMessagePinned(input: {
	channelId: string;
	messageId: string;
	pinned: boolean;
}): Promise<{ ok: true } | { ok: false; reason: PinFailure }> {
	const room = rooms.get(input.channelId);
	if (!room || room.channel.state !== 'joined') {
		return Promise.resolve({ ok: false, reason: 'failed' });
	}

	return new Promise((resolve) => {
		room.channel
			.push(input.pinned ? 'pin' : 'unpin', { message_id: input.messageId })
			.receive('ok', () => resolve({ ok: true }))
			.receive('error', (reply: { reason?: string }) => {
				const reason = reply?.reason;
				resolve({
					ok: false,
					reason: reason === 'limit_reached' || reason === 'rate_limited' ? reason : 'failed'
				});
			})
			.receive('timeout', () => resolve({ ok: false, reason: 'failed' }));
	});
}

export type DeleteFailure = 'forbidden' | 'rate_limited' | 'failed';

export function deleteMessage(input: {
	channelId: string;
	messageId: string;
}): Promise<{ ok: true } | { ok: false; reason: DeleteFailure }> {
	const room = rooms.get(input.channelId);
	if (!room || room.channel.state !== 'joined') {
		return Promise.resolve({ ok: false, reason: 'failed' });
	}

	return new Promise((resolve) => {
		room.channel
			.push('delete', { message_id: input.messageId })
			.receive('ok', () => resolve({ ok: true }))
			.receive('error', (reply: { reason?: string }) => {
				const reason = reply?.reason;
				if (reason === 'not_found') resolve({ ok: true });
				else if (reason === 'forbidden' || reason === 'rate_limited') resolve({ ok: false, reason });
				else resolve({ ok: false, reason: 'failed' });
			})
			.receive('timeout', () => resolve({ ok: false, reason: 'failed' }));
	});
}

export function subscribeToPins(input: {
	channelId: string;
	onPinned: (messageId: string, pinned: boolean) => void;
	onReady: () => void;
}): () => void {
	const { room, release } = hold(input.channelId, input.onReady);
	const { channel } = room;

	const pinnedRef = channel.on('pinned', (payload: { message_id?: unknown; pinned?: unknown }) => {
		if (typeof payload?.message_id === 'string' && typeof payload.pinned === 'boolean') {
			input.onPinned(payload.message_id, payload.pinned);
		}
	});

	return () => {
		channel.off('pinned', pinnedRef);
		release();
	};
}

export function sendTyping(channelId: string) {
	rooms.get(channelId)?.channel.push('typing', {});
}

export function subscribeToChannel(input: {
	channelId: string;
	onMessage: (message: Message) => void;
	onTyping: (userId: string) => void;
	onDeleted: (messageId: string) => void;
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
	const deletedRef = channel.on('deleted', (payload: { message_id?: unknown }) => {
		if (typeof payload?.message_id === 'string') input.onDeleted(payload.message_id);
	});

	return () => {
		channel.off('message', messageRef);
		channel.off('typing', typingRef);
		channel.off('deleted', deletedRef);
		release();
	};
}
