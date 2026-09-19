import { Presence, type Channel as PhoenixChannel } from 'phoenix';
import { phoenixSocket } from '$lib/realtime/socket';

export interface ServerPresence {
	online: Set<string>;
	voice: Record<string, string[]>;
}

interface PresenceMeta {
	voice_channel_id?: string;
}

const channels = new Map<string, PhoenixChannel>();

function collect(presence: Presence): ServerPresence {
	const online = new Set<string>();
	const voice: Record<string, string[]> = {};
	presence.list((userId: string, { metas }: { metas: PresenceMeta[] }) => {
		online.add(userId);
		const channelId = metas.find((meta) => meta.voice_channel_id)?.voice_channel_id;
		if (channelId) (voice[channelId] ??= []).push(userId);
	});
	return { online, voice };
}

export function subscribeToServerPresence(input: {
	serverId: string;
	voiceChannelId: () => string | null;
	onSync: (presence: ServerPresence) => void;
}): () => void {
	const channel = phoenixSocket().channel(`server:${input.serverId}`);
	channels.set(input.serverId, channel);

	const presence = new Presence(channel);
	presence.onSync(() => input.onSync(collect(presence)));
	channel.join().receive('ok', () => {
		const channelId = input.voiceChannelId();
		if (channelId) channel.push('voice:join', { channel_id: channelId });
	});

	return () => {
		if (channels.get(input.serverId) === channel) channels.delete(input.serverId);
		channel.leave();
	};
}

export function setVoiceChannel(serverId: string, channelId: string | null) {
	const channel = channels.get(serverId);
	if (!channel) return;
	if (channelId) channel.push('voice:join', { channel_id: channelId });
	else channel.push('voice:leave', {});
}
