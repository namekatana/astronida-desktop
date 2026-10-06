import type { Channel } from 'phoenix';
import {
	fromPayload,
	messageEditFrom,
	type Message,
	type MessagePayload
} from '$lib/messages/messages';
import { userStatusFrom, type UserStatus } from '$lib/presence/status';
import {
	profileChangesFrom,
	profileDetails,
	type ProfileDetails
} from '$lib/profile/profile-details.svelte';
import { pushTo } from '$lib/realtime/push';
import { phoenixSocket } from '$lib/realtime/socket';

export interface DirectUnread {
	channelId: string;
	count: number;
	newestId: string;
	readId: string | null;
}

export interface ChannelUnread {
	channelId: string;
	newestId: string;
	readId: string | null;
}

export interface ChannelNewest {
	channelId: string;
	newestId: string;
}

export interface UnreadSnapshot {
	direct: DirectUnread[];
	channels: ChannelUnread[];
	latest: ChannelNewest[];
}

interface SnapshotPayload {
	direct: { channel_id: string; count: number; newest_id: string; read_id: string | null }[];
	channels: { channel_id: string; newest_id: string; read_id: string | null }[];
	latest: { channel_id: string; newest_id: string }[];
	status?: unknown;
}

const readFlushMs = 1000;

let inbox: Channel | null = null;
const queuedReads = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function toSnapshot(payload: SnapshotPayload): UnreadSnapshot {
	return {
		direct: payload.direct.map((entry) => ({
			channelId: entry.channel_id,
			count: entry.count,
			newestId: entry.newest_id,
			readId: entry.read_id ?? null
		})),
		channels: payload.channels.map((entry) => ({
			channelId: entry.channel_id,
			newestId: entry.newest_id,
			readId: entry.read_id ?? null
		})),
		latest: payload.latest.map((entry) => ({
			channelId: entry.channel_id,
			newestId: entry.newest_id
		}))
	};
}

export function subscribeToInbox(input: {
	userId: string;
	onSnapshot: (snapshot: UnreadSnapshot) => void;
	onDirectMessage: (channelId: string, message: Message) => void;
	onRead: (channelId: string, messageId: string) => void;
	onTyping: (channelId: string, userId: string) => void;
	onMessageDeleted: (channelId: string, messageId: string) => void;
	onMessageEdited: (channelId: string, messageId: string, content: string) => void;
	onStatus: (status: UserStatus) => void;
	onStatusRestored: (status: UserStatus | null) => void;
	onAvatarChanged: (avatarId: string | null) => void;
	onProfileChanged: (changes: Partial<ProfileDetails>) => void;
}): () => void {
	const channel = phoenixSocket().channel(`inbox:${input.userId}`);

	channel.on('profile_updated', (payload: unknown) => {
		const update = profileChangesFrom(payload);
		if (update) input.onProfileChanged(update.changes);
	});
	channel.on('avatar_changed', (payload: { avatar_id?: unknown }) => {
		input.onAvatarChanged(typeof payload?.avatar_id === 'string' ? payload.avatar_id : null);
	});
	channel.on('direct_message', (payload: MessagePayload) => {
		input.onDirectMessage(payload.channel_id, fromPayload(payload));
	});
	channel.on('read', (payload: { channel_id: string; message_id: string }) => {
		input.onRead(payload.channel_id, payload.message_id);
	});
	channel.on('typing', (payload: { channel_id: string; user_id: string }) => {
		input.onTyping(payload.channel_id, payload.user_id);
	});
	channel.on('message_deleted', (payload: { channel_id?: unknown; message_id?: unknown }) => {
		if (typeof payload?.channel_id === 'string' && typeof payload.message_id === 'string') {
			input.onMessageDeleted(payload.channel_id, payload.message_id);
		}
	});
	channel.on('message_edited', (payload: unknown) => {
		const edit = messageEditFrom(payload);
		if (edit) input.onMessageEdited(edit.channelId, edit.messageId, edit.content);
	});
	channel.on('status', (payload: { status?: unknown }) => {
		const status = userStatusFrom(payload?.status);
		if (status) input.onStatus(status);
	});
	channel.join().receive('ok', (reply: SnapshotPayload) => {
		profileDetails.markStale();
		input.onSnapshot(toSnapshot(reply));
		input.onStatusRestored(userStatusFrom(reply.status));
	});

	inbox = channel;

	return () => {
		if (inbox === channel) inbox = null;
		channel.leave();
	};
}

function flushReads() {
	flushTimer = null;
	const channel = inbox;
	if (!channel) return;
	for (const [channelId, messageId] of queuedReads) {
		channel.push('read', { channel_id: channelId, message_id: messageId });
	}
	queuedReads.clear();
}

export async function pushStatus(status: UserStatus): Promise<boolean> {
	if (!inbox) return false;
	const outcome = await pushTo<unknown>(inbox, 'status', { status });
	return outcome.ok;
}

export function markRead(channelId: string, messageId: string) {
	const queued = queuedReads.get(channelId);
	if (!queued || queued < messageId) queuedReads.set(channelId, messageId);
	flushTimer ??= setTimeout(flushReads, readFlushMs);
}
