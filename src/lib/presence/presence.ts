import { Presence, type Channel as PhoenixChannel } from 'phoenix';
import { phoenixSocket } from '$lib/realtime/socket';

const channels = new Map<string, PhoenixChannel>();

export function subscribeToServerPresence(input: {
	serverId: string;
	onSync: (onlineUserIds: Set<string>) => void;
}): () => void {
	const channel = phoenixSocket().channel(`server:${input.serverId}`);
	channels.set(input.serverId, channel);

	const presence = new Presence(channel);
	presence.onSync(() => {
		const online = new Set<string>();
		presence.list((userId: string) => online.add(userId));
		input.onSync(online);
	});
	channel.join();

	return () => {
		if (channels.get(input.serverId) === channel) channels.delete(input.serverId);
		channel.leave();
	};
}
