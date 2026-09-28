import type { ServersPresence } from '$lib/presence/servers-presence.svelte';
import type { Member } from '$lib/servers/members';
import type { VoiceOccupant } from './occupant';
import { qualityFromStats, worstQuality } from './quality';
import { createRosterWatcher } from './roster-watch';
import { playToggleSound } from './sounds';
import type { VoiceQuality, VoiceStats } from './transport';
import { voice } from './voice.svelte';

export function createVoiceOccupants(input: {
	userId: string;
	presence: ServersPresence;
	membersOf: (serverId: string) => Member[];
	selectedServerId: () => string | null;
}) {
	const { userId, presence } = input;

	function occupantsOf(serverId: string, channelId: string): VoiceOccupant[] {
		const roster = input.membersOf(serverId);
		const inVoice = presence.byServer[serverId]?.voice[channelId] ?? [];
		const inMyRoom = voice.connected?.channelId === channelId;
		const speakingHere = inMyRoom ? voice.speakingIds : [];
		const statsOf = (memberId: string): VoiceStats | null => {
			if (!inMyRoom) return null;
			if (memberId === userId) return voice.stats;
			return voice.participantStats[memberId] ?? null;
		};
		const qualityOf = (memberId: string, stats: VoiceStats | null): VoiceQuality | null => {
			if (!inMyRoom) return null;
			if (memberId === userId) return voice.quality;
			return worstQuality(qualityFromStats(stats), voice.participantQuality[memberId]);
		};
		const byId = new Map(roster.map((member) => [member.id, member]));
		const speaking = new Set(speakingHere);
		const listed: VoiceOccupant[] = [];
		for (const entry of inVoice) {
			const member = byId.get(entry.userId);
			if (!member) continue;
			const stats = statsOf(member.id);
			listed.push({
				...member,
				self: member.id === userId,
				micMuted: entry.micMuted,
				deafened: entry.deafened,
				speaking: speaking.has(member.id),
				quality: qualityOf(member.id, stats),
				stats
			});
		}
		const selfIndex = listed.findIndex((member) => member.id === userId);
		if (selfIndex <= 0) return listed;
		return [listed[selfIndex], ...listed.slice(0, selfIndex), ...listed.slice(selfIndex + 1)];
	}

	const byChannel = $derived.by((): Record<string, VoiceOccupant[]> => {
		const serverId = input.selectedServerId();
		if (!serverId) return {};
		const channels = presence.byServer[serverId]?.voice ?? {};
		return Object.fromEntries(
			Object.keys(channels).map((channelId) => [channelId, occupantsOf(serverId, channelId)])
		);
	});

	const participants = $derived.by((): VoiceOccupant[] => {
		const connected = voice.connected;
		if (!connected) return [];
		return occupantsOf(connected.serverId, connected.channelId);
	});

	const roster = createRosterWatcher(userId);

	$effect(() => {
		const connected = voice.connected;
		const settled = voice.status === 'connected' || voice.status === 'reconnecting';
		const room = connected && settled ? connected : null;
		const userIds = room
			? (presence.byServer[room.serverId]?.voice[room.channelId] ?? []).map((entry) => entry.userId)
			: [];
		const change = roster.update(room?.channelId ?? null, userIds);
		if (change.joined.length > 0) playToggleSound('user-joined');
		if (change.left.length > 0) playToggleSound('user-left');
	});

	return {
		get byChannel() {
			return byChannel;
		},
		get participants() {
			return participants;
		}
	};
}
