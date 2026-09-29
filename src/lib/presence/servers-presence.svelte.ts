import { untrack } from 'svelte';
import { workspaceCache } from '$lib/cache/workspace-cache';
import type { Category, Channel } from '$lib/channels/channels';
import type { Message } from '$lib/messages/messages';
import type { JoinedMember } from '$lib/servers/members';
import { voice } from '$lib/voice/voice.svelte';
import { subscribeToServerPresence, type ServerPresence, type VoiceAnnouncement } from './presence';

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
	onCategoryCreated: (category: Category) => void;
	onChannelCreated: (channel: Channel) => void;
	onMemberJoined: (serverId: string, member: JoinedMember) => void;
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
			onVoiceKeyRotated: (channelId, version) =>
				voice.handleKeyRotation(serverId, channelId, version),
			onVoiceRejoined: (channelId, key) => voice.handleRejoin(serverId, channelId, key),
			onChannelMessage: (channelId, message) =>
				input.onChannelMessage(serverId, channelId, message),
			onCategoryCreated: input.onCategoryCreated,
			onChannelCreated: input.onChannelCreated,
			onMemberJoined: (member) => input.onMemberJoined(serverId, member)
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
