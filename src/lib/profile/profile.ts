import type { Workspace } from '$lib/cache/workspace-cache';
import type { Friend } from '$lib/friends/friends';
import { memberStatuses } from '$lib/presence/member-statuses.svelte';
import type { ServerPresence } from '$lib/presence/presence';
import type { UserStatus } from '$lib/presence/status';
import type { Member } from '$lib/servers/members';
import type { Server } from '$lib/servers/servers';
import { knownAvatars } from './known-avatars.svelte';
import type { ProfileDetails } from './profile-details.svelte';
import type { WidgetDrag } from './widget-drag.svelte';
import type { ProfileWidget, WidgetType } from './widgets';

export interface ProfileTarget {
	id: string;
	username: string;
	name: string;
	avatarId?: string | null;
}

export type ProfileRelation = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

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
	avatarId: string | null;
	bannerId: string | null;
	bio: string | null;
	widgets: ProfileWidget[] | null;
}

export type AvatarPreview = { kind: 'current' } | { kind: 'none' } | { kind: 'draft'; url: string };

export interface ProfileEditing {
	avatar: AvatarPreview;
	banner: AvatarPreview;
	bio: string;
	locked: boolean;
	notice: string;
	noticeTone: 'hint' | 'danger' | 'done';
	onavatarclick: (anchor: HTMLElement) => void;
	onbannerclick: (anchor: HTMLElement) => void;
	onbioinput: (value: string) => void;
	widgets: WidgetEditing;
}

export interface WidgetEditing {
	list: ProfileWidget[];
	drag: WidgetDrag;
	ownedServers: Server[];
	onremove: (type: WidgetType) => void;
	onlinkedit: (anchor: HTMLElement, index: number | null) => void;
	onserverpick: (anchor: HTMLElement) => void;
	onoverflow: (type: WidgetType) => void;
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
	requests: Friend[],
	outgoingIds: ReadonlySet<string>
): ProfileRelation {
	if (targetId === selfId) return 'self';
	if (friends.some((friend) => friend.id === targetId)) return 'friend';
	if (requests.some((request) => request.id === targetId)) return 'incoming';
	if (outgoingIds.has(targetId)) return 'outgoing';
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
	selfAvatarId: string | null;
	detailsOf: (userId: string) => ProfileDetails;
	friends: Member[];
	requests: Friend[];
	outgoingIds: ReadonlySet<string>;
	servers: Server[];
	presenceByServer: Record<string, ServerPresence>;
	workspaces: Record<string, Workspace>;
}): ProfileCard {
	const { target, selfId } = input;
	const relation = relationOf(target.id, selfId, input.friends, input.requests, input.outgoingIds);
	const friend = input.friends.find((known) => known.id === target.id);
	const sharedStatus = memberStatuses.of(target.id);
	const online = relation === 'self' || (friend?.online ?? false) || sharedStatus !== null;
	const status =
		relation === 'self'
			? input.selfStatus
			: friend?.online
				? (friend.status ?? 'online')
				: (sharedStatus ?? 'online');
	const details = input.detailsOf(target.id);
	const mutualIds = new Set(details.mutualServerIds ?? []);
	const mutualServers =
		relation === 'self' ? [] : input.servers.filter((server) => mutualIds.has(server.id));
	return {
		target,
		relation,
		online,
		status,
		voice: voiceOf(target.id, input.servers, input.presenceByServer, input.workspaces),
		mutualServers,
		avatarId: relation === 'self' ? input.selfAvatarId : avatarOf(target, friend),
		bannerId: details.bannerId,
		bio: details.bio,
		widgets: details.widgets
	};
}

function avatarOf(target: ProfileTarget, friend: Member | undefined): string | null {
	if (knownAvatars.has(target.id)) return knownAvatars.of(target.id);
	if (friend?.avatarId !== undefined) return friend.avatarId;
	return target.avatarId ?? null;
}
