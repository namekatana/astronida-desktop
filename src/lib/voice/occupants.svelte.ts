import { rejoinedWithin, type VoiceMember, type VoiceProfile } from '$lib/presence/presence';
import type { ServersPresence } from '$lib/presence/servers-presence.svelte';
import { avatarIdOf } from '$lib/profile/known-avatars.svelte';
import type { VoiceOccupant } from './occupant';
import { qualityFromStats, worstQuality } from './quality';
import { createRosterWatcher } from './roster-watch';
import { playToggleSound } from './sounds';
import type { VoiceQuality, VoiceStats } from './transport';
import { voice } from './voice.svelte';

const resyncQuietMs = 10_000;

export function createVoiceOccupants(input: {
	userId: string;
	presence: ServersPresence;
	ownerOf: (serverId: string) => string | null;
	selfProfile: () => VoiceProfile;
	selectedServerId: () => string | null;
}) {
	const { userId, presence } = input;
	const lastProfiles = new Map<string, VoiceProfile>();

	function profileOf(entry: VoiceMember): VoiceProfile | null {
		if (entry.userId === userId) return input.selfProfile();
		if (entry.profile) {
			lastProfiles.set(entry.userId, entry.profile);
			return entry.profile;
		}
		return lastProfiles.get(entry.userId) ?? null;
	}

	function connectedTo(serverId: string, channelId: string): boolean {
		const current = voice.connected;
		const live = voice.status === 'connected' || voice.status === 'reconnecting';
		return live && current?.serverId === serverId && current.channelId === channelId;
	}

	function voiceMembersOf(serverId: string, channelId: string): VoiceMember[] {
		const announced = presence.byServer[serverId]?.voice[channelId] ?? [];
		if (!connectedTo(serverId, channelId)) return announced;
		const known = new Set(announced.map((entry) => entry.userId));
		const unannounced = [...new Set([userId, ...voice.roomParticipants])].filter(
			(id) => !known.has(id)
		);
		if (unannounced.length === 0) return announced;
		return [
			...announced,
			...unannounced.map((id) => ({
				userId: id,
				micMuted: id === userId && (voice.micMuted || voice.deafened),
				deafened: id === userId && voice.deafened,
				status: null,
				profile: null
			}))
		];
	}

	function occupantsOf(serverId: string, channelId: string): VoiceOccupant[] {
		const ownerId = input.ownerOf(serverId);
		const inVoice = voiceMembersOf(serverId, channelId);
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
		const speaking = new Set(speakingHere);
		const listed: VoiceOccupant[] = [];
		for (const entry of inVoice) {
			const profile = profileOf(entry);
			if (!profile) continue;
			const id = entry.userId;
			const stats = statsOf(id);
			listed.push({
				id,
				username: profile.username,
				name: profile.name,
				avatarId: avatarIdOf(id, profile.avatarId),
				online: true,
				status: entry.status ?? undefined,
				owner: id === ownerId,
				self: id === userId,
				micMuted: entry.micMuted,
				deafened: entry.deafened,
				speaking: speaking.has(id),
				quality: qualityOf(id, stats),
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
		const channelIds = new Set(Object.keys(presence.byServer[serverId]?.voice ?? {}));
		const current = voice.connected;
		if (current?.serverId === serverId && connectedTo(serverId, current.channelId)) {
			channelIds.add(current.channelId);
		}
		return Object.fromEntries(
			[...channelIds].map((channelId) => [channelId, occupantsOf(serverId, channelId)])
		);
	});

	const participants = $derived.by((): VoiceOccupant[] => {
		const connected = voice.connected;
		if (!connected) return [];
		return occupantsOf(connected.serverId, connected.channelId);
	});

	const roster = createRosterWatcher(userId);
	let recoveredAt = 0;
	let previousStatus = voice.status;

	function recovering(serverId: string): boolean {
		const now = Date.now();
		return (
			voice.status === 'reconnecting' ||
			now - recoveredAt < resyncQuietMs ||
			rejoinedWithin(serverId, resyncQuietMs)
		);
	}

	$effect(() => {
		const status = voice.status;
		if (previousStatus === 'reconnecting' && status === 'connected') recoveredAt = Date.now();
		previousStatus = status;
	});

	$effect(() => {
		const connected = voice.connected;
		const settled = voice.status === 'connected' || voice.status === 'reconnecting';
		const room = connected && settled ? connected : null;
		const userIds = room
			? voiceMembersOf(room.serverId, room.channelId).map((entry) => entry.userId)
			: [];
		const change = roster.update(room?.channelId ?? null, userIds);
		if (!room || recovering(room.serverId)) return;
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
