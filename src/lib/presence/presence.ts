import { Presence, type Channel as PhoenixChannel } from 'phoenix';
import { categoryFrom, channelFrom, type Category, type Channel } from '$lib/channels/channels';
import { fromPayload, type Message, type MessagePayload } from '$lib/messages/messages';
import { knownAvatars } from '$lib/profile/known-avatars.svelte';
import { profileChangesFrom, profileDetails } from '$lib/profile/profile-details.svelte';
import { pushTo } from '$lib/realtime/push';
import { asRecord } from '$lib/ui/record';
import { presenceStatusFrom, type PresenceStatus } from './status';
import { phoenixSocket } from '$lib/realtime/socket';

export interface VoiceProfile {
	username: string;
	name: string;
	avatarId: string | null;
}

export interface VoiceMember {
	userId: string;
	micMuted: boolean;
	deafened: boolean;
	status: PresenceStatus | null;
	profile: VoiceProfile | null;
}

export interface ServerPresence {
	voice: Record<string, VoiceMember[]>;
}

export interface ChannelActivity {
	channelId: string;
	firstId: string;
	messageId: string;
	authorId: string;
}

function activityEntryFrom(value: unknown): ChannelActivity[] {
	const entry = asRecord(value) ?? {};
	const { channel_id: channelId, message_id: messageId, author_id: authorId } = entry;
	if (typeof channelId !== 'string' || typeof messageId !== 'string') return [];
	if (typeof authorId !== 'string') return [];
	const firstId =
		typeof entry.first_id === 'string' && entry.first_id <= messageId ? entry.first_id : messageId;
	return [{ channelId, firstId, messageId, authorId }];
}

function channelActivityFrom(payload: unknown): ChannelActivity[] {
	const channels = asRecord(payload)?.channels;
	return Array.isArray(channels) ? channels.flatMap(activityEntryFrom) : [];
}

export interface VoiceAnnouncement {
	channelId: string;
	micMuted: boolean;
	deafened: boolean;
}

export interface VoiceState {
	micMuted: boolean;
	deafened: boolean;
}

export interface VoiceKey {
	key: string;
	version: number;
	epoch?: string;
}

export interface VoiceCredentials {
	url: string;
	token: string;
	e2ee: VoiceKey;
}

export type VoiceJoinResult =
	{ ok: true; value: VoiceCredentials } | { ok: false; message: string };

interface PresenceMeta {
	voice_channel_id?: unknown;
	mic_muted?: unknown;
	deafened?: unknown;
	status?: unknown;
	username?: unknown;
	display_name?: unknown;
	avatar_id?: unknown;
}

function voiceProfileFrom(meta: PresenceMeta): VoiceProfile | null {
	if (typeof meta.username !== 'string' || typeof meta.display_name !== 'string') return null;
	const avatarId = typeof meta.avatar_id === 'string' ? meta.avatar_id : null;
	return { username: meta.username, name: meta.display_name, avatarId };
}

function voiceMemberFrom(userId: string, meta: PresenceMeta): VoiceMember {
	const profile = voiceProfileFrom(meta);
	if (profile) knownAvatars.learn(userId, profile.avatarId);
	return {
		userId,
		micMuted: meta.mic_muted === true,
		deafened: meta.deafened === true,
		status: meta.status === 'offline' ? null : presenceStatusFrom(meta.status),
		profile
	};
}

interface JoinReply {
	url: string;
	token: string;
	e2ee_key: string;
	e2ee_version: number;
	e2ee_epoch?: string;
}

const channels = new Map<string, PhoenixChannel>();
const voiceUrls = new Map<string, string>();
const crowdedServers = new Set<string>();
const rejoinedAt = new Map<string, number>();
let watchedServerId: string | null = null;

function collect(presence: Presence): ServerPresence {
	const voice: Record<string, VoiceMember[]> = {};
	presence.list((userId: string, { metas }: { metas: PresenceMeta[] }) => {
		const meta = metas.find((candidate) => typeof candidate.voice_channel_id === 'string');
		if (!meta || typeof meta.voice_channel_id !== 'string') return;
		(voice[meta.voice_channel_id] ??= []).push(voiceMemberFrom(userId, meta));
	});
	return { voice };
}

const offlineMessage = 'Нет соединения с сервером';

async function pushJoin(
	channel: PhoenixChannel,
	announcement: VoiceAnnouncement
): Promise<VoiceJoinResult> {
	const outcome = await pushTo<JoinReply>(channel, 'voice:join', {
		channel_id: announcement.channelId,
		mic_muted: announcement.micMuted,
		deafened: announcement.deafened
	});
	if (!outcome.ok) {
		const message =
			outcome.reason === 'timeout' ? offlineMessage : 'Не удалось подключиться к голосу';
		return { ok: false, message };
	}
	const reply = outcome.reply;
	return {
		ok: true,
		value: {
			url: reply.url,
			token: reply.token,
			e2ee: { key: reply.e2ee_key, version: reply.e2ee_version, epoch: reply.e2ee_epoch }
		}
	};
}

export function subscribeToServerPresence(input: {
	serverId: string;
	voiceAnnouncement: () => VoiceAnnouncement | null;
	onSync: (presence: ServerPresence) => void;
	onVoiceKeyRotated: (channelId: string, version: number, epoch: string | undefined) => void;
	onVoiceRejoined: (channelId: string, credentials: VoiceCredentials) => void;
	onChannelMessage: (channelId: string, message: Message) => void;
	onChannelActivity: (activity: ChannelActivity[]) => void;
	onCategoryCreated: (category: Category) => void;
	onChannelCreated: (channel: Channel) => void;
	onMessageDeleted: (channelId: string, messageId: string) => void;
}): () => void {
	const channel = phoenixSocket().channel(`server:${input.serverId}`);
	channels.set(input.serverId, channel);

	const presence = new Presence(channel);
	let joinedOnce = false;
	presence.onSync(() => input.onSync(collect(presence)));
	channel.on(
		'voice_key_rotated',
		(payload: { channel_id: string; version: number; epoch?: unknown }) => {
			const epoch = typeof payload.epoch === 'string' ? payload.epoch : undefined;
			input.onVoiceKeyRotated(payload.channel_id, payload.version, epoch);
		}
	);
	channel.on('channel_message', (payload: MessagePayload) => {
		input.onChannelMessage(payload.channel_id, fromPayload(payload));
	});
	channel.on('channel_activity', (payload: unknown) => {
		const activity = channelActivityFrom(payload);
		if (activity.length > 0) input.onChannelActivity(activity);
	});
	channel.on('message_deleted', (payload: { channel_id?: unknown; message_id?: unknown }) => {
		if (typeof payload?.channel_id === 'string' && typeof payload.message_id === 'string') {
			input.onMessageDeleted(payload.channel_id, payload.message_id);
		}
	});
	channel.on('category_created', (payload: unknown) => {
		const category = categoryFrom(payload);
		if (category?.serverId === input.serverId) input.onCategoryCreated(category);
	});
	channel.on('channel_created', (payload: unknown) => {
		const created = channelFrom(payload);
		if (created?.serverId === input.serverId) input.onChannelCreated(created);
	});
	channel.on('avatar_changed', (payload: { user_id?: unknown; avatar_id?: unknown }) => {
		if (typeof payload?.user_id !== 'string') return;
		knownAvatars.learn(
			payload.user_id,
			typeof payload.avatar_id === 'string' ? payload.avatar_id : null
		);
	});
	channel.on('profile_updated', (payload: unknown) => {
		const update = profileChangesFrom(payload);
		if (update?.userId) profileDetails.apply(update.userId, update.changes);
	});
	channel.join().receive('ok', (reply: { voice_url: string; crowded?: unknown }) => {
		voiceUrls.set(input.serverId, reply.voice_url);
		if (joinedOnce) rejoinedAt.set(input.serverId, Date.now());
		joinedOnce = true;
		if (reply.crowded === true) crowdedServers.add(input.serverId);
		else crowdedServers.delete(input.serverId);
		if (watchedServerId === input.serverId && crowdedServers.has(input.serverId)) {
			pushWatchMembers(channel, true);
		}
		const announcement = input.voiceAnnouncement();
		if (!announcement) return;
		void pushJoin(channel, announcement).then((result) => {
			if (result.ok) input.onVoiceRejoined(announcement.channelId, result.value);
		});
	});

	return () => {
		if (channels.get(input.serverId) === channel) channels.delete(input.serverId);
		voiceUrls.delete(input.serverId);
		crowdedServers.delete(input.serverId);
		rejoinedAt.delete(input.serverId);
		channel.leave();
	};
}

function pushWatchMembers(channel: PhoenixChannel, watching: boolean) {
	channel.push('watch_members', { watching });
}

function crowdedChannel(serverId: string | null): PhoenixChannel | undefined {
	return serverId && crowdedServers.has(serverId) ? channels.get(serverId) : undefined;
}

export function watchMembers(serverId: string | null) {
	if (watchedServerId === serverId) return;
	const previous = crowdedChannel(watchedServerId);
	watchedServerId = serverId;
	if (previous) pushWatchMembers(previous, false);
	const next = crowdedChannel(serverId);
	if (next) pushWatchMembers(next, true);
}

export function rejoinedWithin(serverId: string, windowMs: number): boolean {
	const at = rejoinedAt.get(serverId);
	return at !== undefined && Date.now() - at < windowMs;
}

export function voiceUrl(serverId: string): string | null {
	return voiceUrls.get(serverId) ?? null;
}

export function joinVoice(
	serverId: string,
	announcement: VoiceAnnouncement
): Promise<VoiceJoinResult> {
	const channel = channels.get(serverId);
	if (!channel) return Promise.resolve({ ok: false, message: offlineMessage });
	return pushJoin(channel, announcement);
}

export function updateVoiceState(serverId: string, state: VoiceState) {
	channels.get(serverId)?.push('voice:update', {
		mic_muted: state.micMuted,
		deafened: state.deafened
	});
}

export function leaveVoice(serverId: string) {
	channels.get(serverId)?.push('voice:leave', {});
}

export async function lookupStatus(
	serverId: string,
	userId: string
): Promise<PresenceStatus | null | undefined> {
	const channel = channels.get(serverId);
	if (!channel) return undefined;
	const outcome = await pushTo<{ status?: unknown }>(channel, 'status_of', { user_id: userId });
	if (!outcome.ok) return undefined;
	const status = outcome.reply.status;
	return typeof status === 'string' ? presenceStatusFrom(status) : null;
}

export async function requestVoiceKey(
	serverId: string,
	channelId: string
): Promise<VoiceKey | null> {
	const channel = channels.get(serverId);
	if (!channel) return null;
	const outcome = await pushTo<VoiceKey>(channel, 'voice_key', { channel_id: channelId });
	return outcome.ok ? outcome.reply : null;
}
