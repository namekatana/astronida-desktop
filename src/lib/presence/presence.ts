import { Presence, type Channel as PhoenixChannel } from 'phoenix';
import { fromPayload, type Message, type MessagePayload } from '$lib/messages/messages';
import { phoenixSocket } from '$lib/realtime/socket';

export interface VoiceMember {
	userId: string;
	micMuted: boolean;
	deafened: boolean;
}

export interface ServerPresence {
	online: Set<string>;
	voice: Record<string, VoiceMember[]>;
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
}

export interface VoiceCredentials {
	url: string;
	token: string;
	e2ee: VoiceKey;
}

export type VoiceJoinResult =
	{ ok: true; value: VoiceCredentials } | { ok: false; message: string };

interface PresenceMeta {
	voice_channel_id?: string;
	mic_muted?: boolean;
	deafened?: boolean;
}

interface JoinReply {
	url: string;
	token: string;
	e2ee_key: string;
	e2ee_version: number;
}

const channels = new Map<string, PhoenixChannel>();
const voiceUrls = new Map<string, string>();

function collect(presence: Presence): ServerPresence {
	const online = new Set<string>();
	const voice: Record<string, VoiceMember[]> = {};
	presence.list((userId: string, { metas }: { metas: PresenceMeta[] }) => {
		online.add(userId);
		const meta = metas.find((candidate) => typeof candidate.voice_channel_id === 'string');
		if (!meta || typeof meta.voice_channel_id !== 'string') return;
		(voice[meta.voice_channel_id] ??= []).push({
			userId,
			micMuted: meta.mic_muted === true,
			deafened: meta.deafened === true
		});
	});
	return { online, voice };
}

function pushJoin(
	channel: PhoenixChannel,
	announcement: VoiceAnnouncement
): Promise<VoiceJoinResult> {
	return new Promise((resolve) => {
		channel
			.push('voice:join', {
				channel_id: announcement.channelId,
				mic_muted: announcement.micMuted,
				deafened: announcement.deafened
			})
			.receive('ok', (reply: JoinReply) =>
				resolve({
					ok: true,
					value: {
						url: reply.url,
						token: reply.token,
						e2ee: { key: reply.e2ee_key, version: reply.e2ee_version }
					}
				})
			)
			.receive('error', () => resolve({ ok: false, message: 'Не удалось подключиться к голосу' }))
			.receive('timeout', () => resolve({ ok: false, message: 'Нет соединения с сервером' }));
	});
}

export function subscribeToServerPresence(input: {
	serverId: string;
	voiceAnnouncement: () => VoiceAnnouncement | null;
	onSync: (presence: ServerPresence) => void;
	onVoiceKeyRotated: (channelId: string, version: number) => void;
	onVoiceRejoined: (channelId: string, key: VoiceKey) => void;
	onChannelMessage: (channelId: string, message: Message) => void;
}): () => void {
	const channel = phoenixSocket().channel(`server:${input.serverId}`);
	channels.set(input.serverId, channel);

	const presence = new Presence(channel);
	presence.onSync(() => input.onSync(collect(presence)));
	channel.on('voice_key_rotated', (payload: { channel_id: string; version: number }) => {
		input.onVoiceKeyRotated(payload.channel_id, payload.version);
	});
	channel.on('channel_message', (payload: MessagePayload) => {
		input.onChannelMessage(payload.channel_id, fromPayload(payload));
	});
	channel.join().receive('ok', (reply: { voice_url: string }) => {
		voiceUrls.set(input.serverId, reply.voice_url);
		const announcement = input.voiceAnnouncement();
		if (!announcement) return;
		void pushJoin(channel, announcement).then((result) => {
			if (result.ok) input.onVoiceRejoined(announcement.channelId, result.value.e2ee);
		});
	});

	return () => {
		if (channels.get(input.serverId) === channel) channels.delete(input.serverId);
		voiceUrls.delete(input.serverId);
		channel.leave();
	};
}

export function voiceUrl(serverId: string): string | null {
	return voiceUrls.get(serverId) ?? null;
}

export function joinVoice(
	serverId: string,
	announcement: VoiceAnnouncement
): Promise<VoiceJoinResult> {
	const channel = channels.get(serverId);
	if (!channel) return Promise.resolve({ ok: false, message: 'Нет соединения с сервером' });
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

export function requestVoiceKey(serverId: string, channelId: string): Promise<VoiceKey | null> {
	const channel = channels.get(serverId);
	if (!channel) return Promise.resolve(null);

	return new Promise((resolve) => {
		channel
			.push('voice_key', { channel_id: channelId })
			.receive('ok', (payload: VoiceKey) => resolve(payload))
			.receive('error', () => resolve(null))
			.receive('timeout', () => resolve(null));
	});
}
