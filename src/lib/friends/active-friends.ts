import type { Workspace } from '$lib/cache/workspace-cache';
import type { ServerPresence } from '$lib/presence/presence';
import type { Member } from '$lib/servers/members';
import type { Server } from '$lib/servers/servers';

export interface ActiveFriend {
	friend: Member;
	serverName: string;
	channelName: string;
}

export function findActiveFriends(input: {
	friends: Member[];
	servers: Server[];
	presenceByServer: Record<string, ServerPresence>;
	workspaces: Record<string, Workspace>;
}): ActiveFriend[] {
	const friendsById = new Map(input.friends.map((friend) => [friend.id, friend]));
	const active = new Map<string, ActiveFriend>();

	for (const server of input.servers) {
		const voice = input.presenceByServer[server.id]?.voice ?? {};
		const channels = input.workspaces[server.id]?.channels ?? [];
		for (const [channelId, voiceMembers] of Object.entries(voice)) {
			const channel = channels.find((known) => known.id === channelId);
			if (!channel) continue;
			for (const { userId } of voiceMembers) {
				const friend = friendsById.get(userId);
				if (!friend || active.has(userId)) continue;
				active.set(userId, { friend, serverName: server.name, channelName: channel.name });
			}
		}
	}

	return [...active.values()];
}
