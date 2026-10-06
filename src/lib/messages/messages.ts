import { knownAvatars } from '$lib/profile/known-avatars.svelte';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface MessageAuthor {
	id: string;
	name: string;
	username: string;
	avatarId?: string | null;
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

export interface MessageAttachment {
	id: string;
	channelId: string;
	width: number;
	height: number;
	thumbHash: string;
	spoiler: boolean;
	localUrl?: string;
}

export interface Message {
	id: string;
	author: MessageAuthor;
	text: string;
	sentAt: Date;
	replyTo?: MessageReply;
	forwardedFrom?: { username: string };
	attachments?: MessageAttachment[];
	edited?: boolean;
	status?: 'sending' | 'failed';
	localKey?: string;
}

export function renderKeyOf(message: Message): string {
	return message.localKey ?? message.id;
}

export const messageMaxLength = 2000;
export const pageSize = 50;
export const pinnedMaxCount = 50;
export const attachmentMaxCount = 10;

const photoOnlyText = 'Фото';

export function previewText(text: string): string {
	return text.trim() === '' ? photoOnlyText : text;
}

interface AuthorPayload {
	id: string;
	username: string;
	display_name: string;
	avatar_id?: string | null;
}

interface AttachmentPayload {
	id: string;
	width: number;
	height: number;
	thumbhash: string;
	spoiler?: boolean;
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
	edited?: boolean;
	attachments?: AttachmentPayload[];
}

export function compareIds(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function avatarIdFrom(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function learnedAuthor(author: MessageAuthor): MessageAuthor {
	knownAvatars.learn(author.id, author.avatarId);
	return author;
}

function authorFrom(payload: AuthorPayload): MessageAuthor {
	return learnedAuthor({
		id: payload.id,
		username: payload.username,
		name: payload.display_name,
		avatarId: avatarIdFrom(payload.avatar_id)
	});
}

function attachmentsFrom(
	channelId: string,
	payloads: AttachmentPayload[] | null | undefined
): MessageAttachment[] {
	if (!Array.isArray(payloads)) return [];
	return payloads.map((payload) => ({
		id: payload.id,
		channelId,
		width: payload.width,
		height: payload.height,
		thumbHash: payload.thumbhash,
		spoiler: payload.spoiler === true
	}));
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
			original: replyOriginal(
				authorFrom(reply.author),
				reply.content,
				reply.forwarded_from?.username
			)
		};
	}
	if (payload.forwarded_from) message.forwardedFrom = { username: payload.forwarded_from.username };
	const attachments = attachmentsFrom(payload.channel_id, payload.attachments);
	if (attachments.length > 0) message.attachments = attachments;
	if (payload.edited) message.edited = true;
	return message;
}

export interface MessageEdit {
	channelId: string;
	messageId: string;
	content: string;
}

export function messageEditFrom(payload: unknown): MessageEdit | null {
	const { channel_id, message_id, content } = (payload ?? {}) as Record<string, unknown>;
	if (typeof channel_id !== 'string' || typeof message_id !== 'string') return null;
	if (typeof content !== 'string') return null;
	return { channelId: channel_id, messageId: message_id, content };
}

type ProfileRow ={ username: string; display_name: string; avatar_id: string | null } | null;

function authorOfRow(authorId: string, profile: ProfileRow): MessageAuthor {
	if (!profile) return { id: authorId, username: 'unknown', name: '?' };
	return learnedAuthor({
		id: authorId,
		username: profile.username,
		name: profile.display_name,
		avatarId: avatarIdFrom(profile.avatar_id)
	});
}

async function loadReplyOriginals(ids: string[]): Promise<Map<string, ReplyOriginal> | null> {
	const originals = new Map<string, ReplyOriginal>();
	if (ids.length === 0) return originals;
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('messages')
			.select(
				'id, author_id, content, forwarded_from_username, profiles (username, display_name, avatar_id)'
			)
			.in('id', ids)
	);
	if (error || !data) return null;
	for (const row of data) {
		originals.set(
			row.id,
			replyOriginal(
				authorOfRow(row.author_id, row.profiles),
				row.content,
				row.forwarded_from_username
			)
		);
	}
	return originals;
}

const messageColumns =
	'id, channel_id, author_id, content, created_at, reply_to_id, forwarded_from_username, edited, profiles (username, display_name, avatar_id), attachments (id, position, width, height, thumbhash, spoiler)';

interface AttachmentRow extends AttachmentPayload {
	position: number | null;
}

interface MessageRow {
	id: string;
	channel_id: string;
	author_id: string;
	content: string;
	created_at: string;
	reply_to_id: string | null;
	forwarded_from_username: string | null;
	edited: boolean;
	profiles: ProfileRow;
	attachments: AttachmentRow[];
}

function orderedAttachments(rows: AttachmentRow[]): AttachmentRow[] {
	return [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
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
		const attachments = attachmentsFrom(row.channel_id, orderedAttachments(row.attachments));
		if (attachments.length > 0) message.attachments = attachments;
		if (row.edited) message.edited = true;
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
