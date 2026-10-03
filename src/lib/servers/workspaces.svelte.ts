import { workspaceCache, type Workspace } from '$lib/cache/workspace-cache';
import { loadChannels, type Category, type Channel } from '$lib/channels/channels';
import { takeJoinedLayout } from './joined-layouts';
import type { Server } from './servers';

export function createWorkspaces(input: {
	userId: string;
	initial: Record<string, Workspace>;
	servers: () => Server[];
}) {
	const all = $state<Record<string, Workspace>>(input.initial);
	const refreshed = new Set<string>();

	async function refresh(server: Server) {
		const loaded = await loadChannels(server.id);
		const fresh = { categories: loaded.categories, channels: loaded.channels };
		all[server.id] = fresh;
		workspaceCache.saveWorkspace(input.userId, server.id, fresh);
	}

	function seedJoined(serverId: string) {
		const layout = takeJoinedLayout(serverId);
		if (!layout || all[serverId]) return;
		all[serverId] = layout;
	}

	$effect(() => {
		for (const server of input.servers()) {
			if (refreshed.has(server.id)) continue;
			refreshed.add(server.id);
			seedJoined(server.id);
			void refresh(server);
		}
	});

	function addCategory(category: Category) {
		const target = all[category.serverId];
		if (!target || target.categories.some((known) => known.id === category.id)) return;
		target.categories.push(category);
	}

	function addChannel(channel: Channel) {
		const target = all[channel.serverId];
		if (!target || target.channels.some((known) => known.id === channel.id)) return;
		target.channels.push(channel);
	}

	function isTextChannel(serverId: string, channelId: string): boolean {
		return all[serverId]?.channels.find((channel) => channel.id === channelId)?.kind === 'text';
	}

	return {
		get all() {
			return all;
		},
		addCategory,
		addChannel,
		isTextChannel
	};
}
