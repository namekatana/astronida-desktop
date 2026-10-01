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

const offlineGraceMs = 10_000;

export function createServersPresence(input: {
	userId: string;
	initial: Record<string, ServerPresence>;
	serverIds: () => string[];
	onChannelMessage: (serverId: string, channelId: string, message: Message) => void;
	onCategoryCreated: (category: Category) => void;
	onChannelCreated: (channel: Channel) => void;
	onMemberJoined: (serverId: string, member: JoinedMember) => void;
	onMessageDeleted: (channelId: string, messageId: string) => void;
}) {
	const byServer = $state<Record<string, ServerPresence>>(input.initial);
	const subscriptions = new Map<string, () => void>();
	const livePresence = new Map<string, ServerPresence>();
	const leaving = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
	const departed = new Map<string, Set<string>>();

	function publish(serverId: string) {
		const live = livePresence.get(serverId);
		if (!live) return;
		const online = new Set(live.online);
		const statuses = { ...live.statuses };
		const previous = byServer[serverId]?.statuses ?? {};
		for (const userId of leaving.get(serverId)?.keys() ?? []) {
			online.add(userId);
			statuses[userId] ??= previous[userId] ?? 'online';
		}
		byServer[serverId] = { online, statuses, voice: live.voice };
	}

	function holdLeavers(serverId: string, presence: ServerPresence) {
		const lingering = leaving.get(serverId) ?? new Map<string, ReturnType<typeof setTimeout>>();
		leaving.set(serverId, lingering);
		for (const userId of presence.online) {
			clearTimeout(lingering.get(userId));
			lingering.delete(userId);
		}
		if (!livePresence.has(serverId)) return;
		const gone = departed.get(serverId);
		for (const userId of byServer[serverId]?.online ?? []) {
			if (presence.online.has(userId) || lingering.has(userId)) continue;
			if (gone?.delete(userId)) continue;
			const timer = setTimeout(() => {
				lingering.delete(userId);
				publish(serverId);
			}, offlineGraceMs);
			lingering.set(userId, timer);
		}
	}

	function dropAtOnce(serverId: string, userId: string) {
		const lingering = leaving.get(serverId);
		const timer = lingering?.get(userId);
		if (lingering && timer !== undefined) {
			clearTimeout(timer);
			lingering.delete(userId);
			publish(serverId);
			return;
		}
		if (!livePresence.get(serverId)?.online.has(userId)) return;
		const gone = departed.get(serverId) ?? new Set<string>();
		gone.add(userId);
		departed.set(serverId, gone);
	}

	function forgetLeavers(serverId: string) {
		for (const timer of leaving.get(serverId)?.values() ?? []) clearTimeout(timer);
		leaving.delete(serverId);
		departed.delete(serverId);
		livePresence.delete(serverId);
	}

	function subscribe(serverId: string) {
		return subscribeToServerPresence({
			serverId,
			voiceAnnouncement: () => announcementFor(serverId),
			onSync: (presence) => {
				holdLeavers(serverId, presence);
				livePresence.set(serverId, presence);
				publish(serverId);
				workspaceCache.savePresence(input.userId, serverId, presence);
			},
			onVoiceKeyRotated: (channelId, version) =>
				voice.handleKeyRotation(serverId, channelId, version),
			onVoiceRejoined: (channelId, key) => voice.handleRejoin(serverId, channelId, key),
			onChannelMessage: (channelId, message) =>
				input.onChannelMessage(serverId, channelId, message),
			onCategoryCreated: input.onCategoryCreated,
			onChannelCreated: input.onChannelCreated,
			onMemberJoined: (member) => input.onMemberJoined(serverId, member),
			onMessageDeleted: input.onMessageDeleted,
			onWentOffline: (userId) => dropAtOnce(serverId, userId)
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
				forgetLeavers(id);
				delete byServer[id];
			}
		});
	});

	$effect(() => {
		return () => {
			for (const unsubscribe of subscriptions.values()) unsubscribe();
			subscriptions.clear();
			for (const serverId of [...leaving.keys()]) forgetLeavers(serverId);
		};
	});

	return {
		get byServer() {
			return byServer;
		}
	};
}
