import type { Workspace } from '$lib/cache/workspace-cache';
import type { Friend } from '$lib/friends/friends';
import type { Server } from '$lib/servers/servers';

export type ForwardTarget =
	| { kind: 'friend'; channelId: string; username: string; name: string; online: boolean }
	| { kind: 'channel'; channelId: string; name: string; serverName: string };

export interface ForwardSection {
	key: string;
	title: string;
	targets: ForwardTarget[];
}

type FriendWithPresence = Friend & { online: boolean };

function friendSection(friends: FriendWithPresence[], query: string): ForwardSection | null {
	const targets: ForwardTarget[] = friends
		.filter((friend) => friend.channelId && friend.username.includes(query))
		.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username))
		.map((friend) => ({
			kind: 'friend',
			channelId: friend.channelId as string,
			username: friend.username,
			name: friend.name,
			online: friend.online
		}));
	return targets.length > 0 ? { key: 'friends', title: 'Друзья', targets } : null;
}

function orderedTextChannels(workspace: Workspace) {
	const text = workspace.channels.filter((channel) => channel.kind === 'text');
	const withoutCategory = text.filter((channel) => channel.categoryId === null);
	const byCategory = workspace.categories.flatMap((category) =>
		text.filter((channel) => channel.categoryId === category.id)
	);
	return [...withoutCategory, ...byCategory];
}

function serverSection(
	server: Server,
	workspace: Workspace | undefined,
	query: string
): ForwardSection | null {
	if (!workspace) return null;
	const serverMatches = server.name.toLowerCase().includes(query);
	const targets: ForwardTarget[] = orderedTextChannels(workspace)
		.filter((channel) => serverMatches || channel.name.toLowerCase().includes(query))
		.map((channel) => ({
			kind: 'channel',
			channelId: channel.id,
			name: channel.name,
			serverName: server.name
		}));
	return targets.length > 0 ? { key: server.id, title: server.name, targets } : null;
}

export function buildForwardSections(input: {
	friends: FriendWithPresence[];
	servers: Server[];
	workspaces: Record<string, Workspace>;
	query: string;
}): ForwardSection[] {
	const query = input.query.trim().toLowerCase().replace(/^[@#]/, '');
	const sections = [
		friendSection(input.friends, query),
		...input.servers.map((server) => serverSection(server, input.workspaces[server.id], query))
	];
	return sections.filter((section): section is ForwardSection => section !== null);
}
