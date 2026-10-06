import type { Channel as PhoenixChannel } from 'phoenix';
import { phoenixSocket } from '$lib/realtime/socket';
import { fromPayload, type Message, type MessagePayload } from './messages';

interface Room {
	channel: PhoenixChannel;
	users: number;
	readyListeners: Set<() => void>;
}

const rooms = new Map<string, Room>();

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

function hold(channelId: string, onReady: () => void): { channel: PhoenixChannel; release: () => void } {
	const room = acquireRoom(channelId);
	room.readyListeners.add(onReady);
	if (room.channel.state === 'joined') onReady();
	return {
		channel: room.channel,
		release: () => {
			room.readyListeners.delete(onReady);
			releaseRoom(channelId, room);
		}
	};
}

export function joinedRoom(channelId: string): PhoenixChannel | null {
	const channel = rooms.get(channelId)?.channel;
	return channel?.state === 'joined' ? channel : null;
}

export function holdRoom(channelId: string, onReady: () => void): () => void {
	return hold(channelId, onReady).release;
}

export function sendTyping(channelId: string) {
	rooms.get(channelId)?.channel.push('typing', {});
}

export function subscribeToPins(input: {
	channelId: string;
	onPinned: (messageId: string, pinned: boolean) => void;
	onReady: () => void;
}): () => void {
	const { channel, release } = hold(input.channelId, input.onReady);

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

export function subscribeToChannel(input: {
	channelId: string;
	onMessage: (message: Message) => void;
	onTyping: (userId: string, username: string | null) => void;
	onDeleted: (messageId: string) => void;
	onEdited: (messageId: string, content: string) => void;
	onReady: () => void;
}): () => void {
	const { channel, release } = hold(input.channelId, input.onReady);

	const messageRef = channel.on('message', (payload: MessagePayload) =>
		input.onMessage(fromPayload(payload))
	);
	const typingRef = channel.on('typing', (payload: { user_id?: unknown; username?: unknown }) => {
		if (typeof payload?.user_id !== 'string') return;
		const username = typeof payload.username === 'string' ? payload.username : null;
		input.onTyping(payload.user_id, username);
	});
	const deletedRef = channel.on('deleted', (payload: { message_id?: unknown }) => {
		if (typeof payload?.message_id === 'string') input.onDeleted(payload.message_id);
	});

	const editedRef = channel.on('edited', (payload: { message_id?: unknown; content?: unknown }) => {
		if (typeof payload?.message_id === 'string' && typeof payload.content === 'string') {
			input.onEdited(payload.message_id, payload.content);
		}
	});

	return () => {
		channel.off('edited', editedRef);
		channel.off('message', messageRef);
		channel.off('typing', typingRef);
		channel.off('deleted', deletedRef);
		release();
	};
}
