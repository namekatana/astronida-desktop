import { untrack } from 'svelte';
import { workspaceCache } from '$lib/cache/workspace-cache';
import type { Category, Channel } from '$lib/channels/channels';
import type { Message } from '$lib/messages/messages';
import { voice } from '$lib/voice/voice.svelte';
import {
	subscribeToServerPresence,
	type ChannelActivity,
	type ServerPresence,
	type VoiceAnnouncement
} from './presence';

function announcementFor(serverId: string): VoiceAnnouncement | null {
	const connected = voice.connected;
	if (!connected || connected.serverId !== serverId || voice.status === 'failed') return null;
	return {
		channelId: connected.channelId,
		micMuted: voice.micMuted,
		deafened: voice.deafened
	};
}

export type ServersPresence = ReturnType<typeof createServersPresence>;

export function createServersPresence(input: {
	userId: string;
	initial: Record<string, ServerPresence>;
	serverIds: () => string[];
	onChannelMessage: (serverId: string, channelId: string, message: Message) => void;
	onChannelActivity: (serverId: string, activity: ChannelActivity[]) => void;
	onCategoryCreated: (category: Category) => void;
	onChannelCreated: (channel: Channel) => void;
	onMessageDeleted: (channelId: string, messageId: string) => void;
}) {
	const byServer = $state<Record<string, ServerPresence>>(input.initial);
	const subscriptions = new Map<string, () => void>();

	function subscribe(serverId: string) {
		return subscribeToServerPresence({
			serverId,
			voiceAnnouncement: () => announcementFor(serverId),
			onSync: (presence) => {
				byServer[serverId] = presence;
				workspaceCache.savePresence(input.userId, serverId, presence);
			},
			onVoiceKeyRotated: (channelId, version, epoch) =>
				voice.handleKeyRotation(serverId, channelId, version, epoch),
			onVoiceRejoined: (channelId, credentials) =>
				voice.handleRejoin(serverId, channelId, credentials),
			onChannelMessage: (channelId, message) =>
				input.onChannelMessage(serverId, channelId, message),
			onChannelActivity: (activity) => input.onChannelActivity(serverId, activity),
			onCategoryCreated: input.onCategoryCreated,
			onChannelCreated: input.onChannelCreated,
			onMessageDeleted: input.onMessageDeleted
		});
	}

	$effect(() => {
		const ids = new Set(input.serverIds());
		untrack(() => {
			for (const id of ids) {
				if (subscriptions.has(id)) continue;
				subscriptions.set(id, subscribe(id));
			}
			for (const [id, unsubscribe] of subscriptions) {
				if (ids.has(id)) continue;
				unsubscribe();
				subscriptions.delete(id);
				delete byServer[id];
			}
		});
	});

	$effect(() => {
		return () => {
			for (const unsubscribe of subscriptions.values()) unsubscribe();
			subscriptions.clear();
		};
	});

	return {
		get byServer() {
			return byServer;
		}
	};
}
