import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface MessageAuthor {
	id: string;
	name: string;
	username: string;
}

export type ReplyOriginal = {
	author: MessageAuthor;
	text: string;
	forwardedFrom?: { username: string };
};

export interface MessageReply {
	id: string;
	original: ReplyOriginal | null;
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

export const messageMaxLength = 2000;
export const pageSize = 50;
export const pinnedMaxCount = 50;

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

export function compareIds(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function authorFrom(payload: AuthorPayload): MessageAuthor {
	return { id: payload.id, username: payload.username, name: payload.display_name };
}

function replyOriginal(
	author: MessageAuthor,
	text: string,
	forwardedFromUsername: string | null | undefined
): ReplyOriginal {
	const original: ReplyOriginal = { author, text };
	if (forwardedFromUsername) original.forwardedFrom = { username: forwardedFromUsername };
	return original;
}

export function fromPayload(payload: MessagePayload): Message {
	const message: Message = {
		id: payload.id,
		author: authorFrom(payload.author),
		text: payload.content,
		sentAt: new Date(payload.created_at)
	};
	const reply = payload.reply_to;
	if (reply) {
		message.replyTo = {
			id: reply.id,
			original: replyOriginal(authorFrom(reply.author), reply.content, reply.forwarded_from?.username)
		};
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

async function loadReplyOriginals(ids: string[]): Promise<Map<string, ReplyOriginal> | null> {
	const originals = new Map<string, ReplyOriginal>();
	if (ids.length === 0) return originals;
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('messages')
			.select('id, author_id, content, forwarded_from_username, profiles (username, display_name)')
			.in('id', ids)
	);
	if (error || !data) return null;
	for (const row of data) {
		originals.set(
			row.id,
			replyOriginal(authorOfRow(row.author_id, row.profiles), row.content, row.forwarded_from_username)
		);
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

export async function loadPinnedMessages(channelId: string): Promise<Message[] | null> {
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('messages')
			.select(messageColumns)
			.eq('channel_id', channelId)
			.eq('pinned', true)
			.order('id', { ascending: false })
			.limit(pinnedMaxCount)
	);
	if (error || !data) return null;
	return messagesFromRows(data);
}
