import type { Member } from '$lib/members/members';
import {
	canModerate,
	type MemberMenuRequest,
	type MemberModeration,
	type ModerationTarget
} from '$lib/members/moderation-target';
import type { ProfileTarget } from '$lib/profile/profile';
import type { Server } from '$lib/servers/servers';
import { toast } from '$lib/ui/toast.svelte';
import type { AppState } from './app-state.svelte';
import type { Overlays } from './overlays.svelte';

export type ModerationActions = ReturnType<typeof createModerationActions>;

export function moderationTargetOf(person: ProfileTarget): ModerationTarget {
	return {
		id: person.id,
		username: person.username,
		name: person.name,
		avatarId: person.avatarId ?? null
	};
}

export function createModerationActions(input: { app: AppState; overlays: Overlays }) {
	const { app, overlays } = input;

	function openMemberMenu(person: ProfileTarget, source: HTMLElement | null, event: MouseEvent) {
		if (!app.selectedServer) return;
		overlays.open({
			kind: 'member-menu',
			request: {
				target: moderationTargetOf(person),
				serverId: app.selectedServer.id,
				x: event.clientX,
				y: event.clientY,
				source
			}
		});
	}

	function openFriendMenu(person: Member, source: HTMLElement | null, event: MouseEvent) {
		overlays.open({
			kind: 'member-menu',
			request: {
				target: moderationTargetOf(person),
				serverId: null,
				x: event.clientX,
				y: event.clientY,
				source
			}
		});
	}

	function memberMenuServer(request: MemberMenuRequest): Server | null {
		return app.servers.find((server) => server.id === request.serverId) ?? null;
	}

	function memberMenuSubtitle(request: MemberMenuRequest): string | null {
		return app.friends.ids.has(request.target.id) ? 'В друзьях' : null;
	}

	function mayModerate(serverId: string | null, targetId: string): boolean {
		if (serverId === null) return false;
		const ownerId = app.servers.find((server) => server.id === serverId)?.ownerId;
		return canModerate({ selfId: app.userId, ownerId, targetId });
	}

	function startModeration(action: 'kick' | 'ban', target: ModerationTarget, serverId: string) {
		const server = app.servers.find((known) => known.id === serverId);
		if (!server) return;
		overlays.open({ kind: 'moderation', action, target, serverId, serverName: server.name });
	}

	function finishModeration() {
		const current = overlays.find('moderation');
		if (!current) return;
		const { action, target } = current;
		overlays.close('moderation');
		toast.show(
			action === 'kick'
				? `@${target.username} удалён с сервера`
				: `@${target.username} заблокирован`
		);
	}

	const voiceModeration: MemberModeration = {
		get serverName() {
			return app.selectedServer?.name ?? '';
		},
		allowed: (userId) => app.selectedServer !== null && mayModerate(app.selectedServer.id, userId),
		onkick: (target) =>
			app.selectedServer && startModeration('kick', target, app.selectedServer.id),
		onban: (target) => app.selectedServer && startModeration('ban', target, app.selectedServer.id)
	};

	return {
		voiceModeration,
		openMemberMenu,
		openFriendMenu,
		memberMenuServer,
		memberMenuSubtitle,
		mayModerate,
		startModeration,
		finishModeration
	};
}
