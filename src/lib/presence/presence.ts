import { Presence, type Channel as PhoenixChannel } from 'phoenix';
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

interface PresenceMeta {
	voice_channel_id?: string;
	mic_muted?: boolean;
	deafened?: boolean;
}

const channels = new Map<string, PhoenixChannel>();

function collect(presence: Presence): ServerPresence {
	const online = new Set<string>();
	const voice: Record<string, VoiceMember[]> = {};
	presence.list((userId: string, { metas }: { metas: PresenceMeta[] }) => {
		online.add(userId);
		const meta = metas.find((candidate) => candidate.voice_channel_id);
		if (!meta?.voice_channel_id) return;
		(voice[meta.voice_channel_id] ??= []).push({
			userId,
			micMuted: meta.mic_muted === true,
			deafened: meta.deafened === true
		});
	});
	return { online, voice };
}

function announce(channel: PhoenixChannel, announcement: VoiceAnnouncement | null) {
	if (!announcement) {
		channel.push('voice:leave', {});
		return;
	}
	channel.push('voice:join', {
		channel_id: announcement.channelId,
		mic_muted: announcement.micMuted,
		deafened: announcement.deafened
	});
}

export function subscribeToServerPresence(input: {
	serverId: string;
	voiceAnnouncement: () => VoiceAnnouncement | null;
	onSync: (presence: ServerPresence) => void;
}): () => void {
	const channel = phoenixSocket().channel(`server:${input.serverId}`);
	channels.set(input.serverId, channel);

	const presence = new Presence(channel);
	presence.onSync(() => input.onSync(collect(presence)));
	channel.join().receive('ok', () => {
		const announcement = input.voiceAnnouncement();
		if (announcement) announce(channel, announcement);
	});

	return () => {
		if (channels.get(input.serverId) === channel) channels.delete(input.serverId);
		channel.leave();
	};
}

export function setVoiceChannel(serverId: string, announcement: VoiceAnnouncement | null) {
	const channel = channels.get(serverId);
	if (channel) announce(channel, announcement);
}

export interface VoiceCredentials {
	url: string;
	token: string;
	e2eeKey: string;
	expiresAt: number;
}

export type VoiceTokenResult =
	| { ok: true; value: VoiceCredentials }
	| { ok: false; message: string };

export function requestVoiceToken(serverId: string, channelId: string): Promise<VoiceTokenResult> {
	const channel = channels.get(serverId);
	if (!channel) return Promise.resolve({ ok: false, message: 'Нет соединения с сервером' });

	return new Promise((resolve) => {
		channel
			.push('voice_token', { channel_id: channelId })
			.receive(
				'ok',
				(payload: { url: string; token: string; expires_in: number; e2ee_key: string }) =>
					resolve({
						ok: true,
						value: {
							url: payload.url,
							token: payload.token,
							e2eeKey: payload.e2ee_key,
							expiresAt: Date.now() + payload.expires_in * 1000
						}
					})
			)
			.receive('error', () => resolve({ ok: false, message: 'Не удалось подключиться к голосу' }))
			.receive('timeout', () => resolve({ ok: false, message: 'Нет соединения с сервером' }));
	});
}
