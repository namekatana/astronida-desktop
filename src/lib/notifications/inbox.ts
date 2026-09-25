import type { Channel } from 'phoenix';
import { fromPayload, type Message, type MessagePayload } from '$lib/messages/messages';
import { phoenixSocket } from '$lib/realtime/socket';

export interface DirectUnread {
	channelId: string;
	count: number;
	newestId: string;
}

export interface ChannelUnread {
	channelId: string;
	newestId: string;
}

export interface UnreadSnapshot {
	direct: DirectUnread[];
	channels: ChannelUnread[];
}

interface SnapshotPayload {
	direct: { channel_id: string; count: number; newest_id: string }[];
	channels: { channel_id: string; newest_id: string }[];
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
			newestId: entry.newest_id
		})),
		channels: payload.channels.map((entry) => ({
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
}): () => void {
	const channel = phoenixSocket().channel(`inbox:${input.userId}`);

	channel.on('direct_message', (payload: MessagePayload) => {
		input.onDirectMessage(payload.channel_id, fromPayload(payload));
	});
	channel.on('read', (payload: { channel_id: string; message_id: string }) => {
		input.onRead(payload.channel_id, payload.message_id);
	});
	channel.join().receive('ok', (reply: SnapshotPayload) => input.onSnapshot(toSnapshot(reply)));

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

export function markRead(channelId: string, messageId: string) {
	const queued = queuedReads.get(channelId);
	if (!queued || queued < messageId) queuedReads.set(channelId, messageId);
	flushTimer ??= setTimeout(flushReads, readFlushMs);
}
