import { phoenixSocket } from '$lib/realtime/socket';

export function subscribeToFriendsPresence(input: {
	userId: string;
	onSync: (online: Set<string>) => void;
}): () => void {
	const channel = phoenixSocket().channel(`friends:${input.userId}`);
	let online = new Set<string>();

	channel.on('friend_presence', (payload: { user_id: string; online: boolean }) => {
		if (payload.online) online.add(payload.user_id);
		else online.delete(payload.user_id);
		input.onSync(new Set(online));
	});
	channel.join().receive('ok', (reply: { online: string[] }) => {
		online = new Set(reply.online);
		input.onSync(new Set(online));
	});

	return () => {
		channel.leave();
	};
}
