import type { Workspace } from '$lib/cache/workspace-cache';
import type { Friend } from '$lib/friends/friends';
import type { ServerPresence } from '$lib/presence/presence';
import type { UserStatus } from '$lib/presence/status';
import type { Member } from '$lib/servers/members';
import type { Server } from '$lib/servers/servers';

export interface ProfileTarget {
	id: string;
	username: string;
	name: string;
}

export type ProfileRelation = 'self' | 'friend' | 'incoming' | 'none';

export interface ProfileVoice {
	channelName: string;
	serverName: string;
}

export interface ProfileCard {
	target: ProfileTarget;
	relation: ProfileRelation;
	online: boolean;
	status: UserStatus;
	voice: ProfileVoice | null;
	mutualServers: Server[];
}

export function avatarIn(element: Element | null): HTMLElement | null {
	if (!element) return null;
	if (element instanceof HTMLElement && element.hasAttribute('data-avatar')) return element;
	return element.querySelector<HTMLElement>('[data-avatar]');
}

function relationOf(
	targetId: string,
	selfId: string,
	friends: Member[],
	requests: Friend[]
): ProfileRelation {
	if (targetId === selfId) return 'self';
	if (friends.some((friend) => friend.id === targetId)) return 'friend';
	if (requests.some((request) => request.id === targetId)) return 'incoming';
	return 'none';
}

function voiceOf(
	targetId: string,
	servers: Server[],
	presenceByServer: Record<string, ServerPresence>,
	workspaces: Record<string, Workspace>
): ProfileVoice | null {
	for (const server of servers) {
		const voice = presenceByServer[server.id]?.voice ?? {};
		for (const [channelId, voiceMembers] of Object.entries(voice)) {
			if (!voiceMembers.some((member) => member.userId === targetId)) continue;
			const channel = workspaces[server.id]?.channels.find((known) => known.id === channelId);
			if (channel) return { channelName: channel.name, serverName: server.name };
		}
	}
	return null;
}

export function describeProfile(input: {
	target: ProfileTarget;
	selfId: string;
	selfStatus: UserStatus;
	friends: Member[];
	requests: Friend[];
	servers: Server[];
	presenceByServer: Record<string, ServerPresence>;
	workspaces: Record<string, Workspace>;
}): ProfileCard {
	const { target, selfId } = input;
	const relation = relationOf(target.id, selfId, input.friends, input.requests);
	const friend = input.friends.find((known) => known.id === target.id);
	const sharedStatus = input.servers
		.map((server) => input.presenceByServer[server.id]?.statuses[target.id])
		.find((status) => status !== undefined);
	const online = relation === 'self' || (friend?.online ?? false) || sharedStatus !== undefined;
	const status =
		relation === 'self'
			? input.selfStatus
			: friend?.online
				? (friend.status ?? 'online')
				: (sharedStatus ?? 'online');
	const mutualServers =
		relation === 'self'
			? []
			: input.servers.filter((server) =>
					input.workspaces[server.id]?.members.some((member) => member.id === target.id)
				);
	return {
		target,
		relation,
		online,
		status,
		voice: voiceOf(target.id, input.servers, input.presenceByServer, input.workspaces),
		mutualServers
	};
}
