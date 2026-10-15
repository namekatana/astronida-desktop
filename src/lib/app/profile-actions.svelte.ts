import { untrack } from 'svelte';
import { openDirect } from '$lib/direct/conversations';
import {
	acceptFriendRequest,
	friendRequestFailureText,
	requestFriendship
} from '$lib/friends/channel';
import { memberStatuses } from '$lib/presence/member-statuses.svelte';
import { ownStatus } from '$lib/presence/own-status.svelte';
import { lookupStatus } from '$lib/presence/presence';
import { describeProfile, type ProfileRelation, type ProfileTarget } from '$lib/profile/profile';
import { profileDetails } from '$lib/profile/profile-details.svelte';
import type { ProfileLinkHandlers, ProfileLinkPerson } from '$lib/profile/profile-link-lookup';
import { profileLinkOf } from '$lib/profile/profile-links';
import { toast } from '$lib/ui/toast.svelte';
import type { AppState } from './app-state.svelte';
import { moderationTargetOf } from './moderation-actions';
import type { Overlays } from './overlays.svelte';

export type ProfileActions = ReturnType<typeof createProfileActions>;

export function createProfileActions(input: { app: AppState; overlays: Overlays }) {
	const { app, overlays } = input;

	let sideProfile = $state<{ target: ProfileTarget; place: string } | null>(null);
	let closingInPlace = false;
	let directOpening = $state<string | null>(null);
	let profileError = $state<{ userId: string; text: string } | null>(null);

	const place = $derived(app.selectedServerId ?? `home:${app.selectedFriendId ?? ''}`);
	const sideTarget = $derived(sideProfile?.place === place ? sideProfile.target : null);
	const dialogTarget = $derived(overlays.find('profile')?.target ?? null);

	function cardOf(target: ProfileTarget) {
		return describeProfile({
			target,
			selfId: app.userId,
			selfStatus: ownStatus.current,
			selfAvatarId: app.avatarId,
			detailsOf: profileDetails.of,
			friends: app.friends.withPresence,
			requests: app.friends.requests,
			outgoingIds: app.friends.outgoingIds,
			servers: app.servers,
			presenceByServer: app.presence.byServer,
			workspaces: app.workspaces.all
		});
	}

	function statusServerFor(userId: string): string | null {
		if (app.selectedServerId) return app.selectedServerId;
		return profileDetails.of(userId).mutualServerIds?.[0] ?? null;
	}

	const dialogCard = $derived(dialogTarget ? cardOf(dialogTarget) : null);
	const sideCard = $derived(sideTarget ? cardOf(sideTarget) : null);
	const chatPartnerCard = $derived(app.selectedFriend ? cardOf(app.selectedFriend) : null);

	$effect(() => {
		if (sideProfile && sideProfile.place !== place) sideProfile = null;
	});

	$effect(() => {
		for (const card of [dialogCard, sideCard, chatPartnerCard]) {
			if (card) profileDetails.refresh(card.target.id);
		}
	});

	const statusTargetId = $derived(sideTarget?.id ?? dialogTarget?.id ?? null);

	$effect(() => {
		const targetId = statusTargetId;
		if (!targetId || targetId === app.userId) return;
		untrack(() => {
			if (app.friends.ids.has(targetId)) return;
			const serverId = statusServerFor(targetId);
			if (!serverId) return;
			void lookupStatus(serverId, targetId).then((status) => {
				if (status !== undefined) memberStatuses.learn(targetId, status);
			});
		});
	});

	function closeSideProfile() {
		closingInPlace = true;
		sideProfile = null;
	}

	function openProfile(target: ProfileTarget, source: HTMLElement | null) {
		const known = { id: target.id, username: target.username, name: target.name };
		if (target.id === app.userId) {
			overlays.open({ kind: 'profile', target: known, source });
			return;
		}
		if (!app.selectedServerId && target.id === app.selectedFriend?.id) {
			closeSideProfile();
			return;
		}
		closingInPlace = false;
		profileError = null;
		sideProfile = { target: known, place };
	}

	function errorFor(userId: string): string | null {
		return profileError?.userId === userId ? profileError.text : null;
	}

	async function befriend(target: ProfileTarget, relation: ProfileRelation): Promise<boolean> {
		profileError = null;
		if (relation === 'incoming') {
			const accepted = await acceptFriendRequest(target.id);
			if (!accepted) {
				profileError = {
					userId: target.id,
					text: 'Не удалось принять запрос — проверьте соединение'
				};
			}
			return accepted;
		}
		const outcome = await requestFriendship(target.id);
		if (!outcome.ok) {
			profileError = { userId: target.id, text: friendRequestFailureText[outcome.reason] };
			return false;
		}
		return true;
	}

	async function messageUser(target: ProfileTarget) {
		if (app.chatPartner(target.id)?.channelId) {
			app.showDirectChat(target.id);
			return;
		}
		if (directOpening) return;
		directOpening = target.id;
		profileError = null;
		const result = await openDirect(target.id);
		directOpening = null;
		if (!result.ok) {
			profileError = { userId: target.id, text: result.message };
			return;
		}
		app.conversations.remember(result.partner);
		app.showDirectChat(result.partner.id);
	}

	function unfriendActionFor(person: ProfileTarget): (() => void) | undefined {
		if (!app.friends.ids.has(person.id)) return undefined;
		return () => overlays.open({ kind: 'unfriend', target: moderationTargetOf(person) });
	}

	function finishUnfriend() {
		const current = overlays.find('unfriend');
		if (!current) return;
		const { username } = current.target;
		overlays.close('unfriend');
		toast.show(`@${username} удалён из друзей`);
	}

	function shareActionFor(person: ProfileTarget): (() => void) | undefined {
		if (person.id === app.userId) return undefined;
		return () => overlays.open({ kind: 'share-profile', target: moderationTargetOf(person) });
	}

	function shareProfile(channelIds: string[], comment: string) {
		const sharing = overlays.find('share-profile');
		if (!sharing) return;
		const link = profileLinkOf(sharing.target.username);
		const note = comment.trim();
		for (const channelId of channelIds) {
			if (note !== '') app.sending.send(channelId, note);
			app.sending.send(channelId, link);
		}
	}

	function lookupProfileUser(handle: string): ProfileLinkPerson | null {
		if (handle === app.username) return { target: app.selfProfile(), relation: 'self' };
		const friend = app.friends.list.find((known) => known.username === handle);
		if (friend) return { target: friend, relation: 'friend' };
		const request = app.friends.requests.find((known) => known.username === handle);
		if (request) return { target: request, relation: 'incoming' };
		const partner = app.conversations.list.find((known) => known.username === handle);
		if (partner) {
			return {
				target: partner,
				relation: app.friends.outgoingIds.has(partner.id) ? 'outgoing' : 'none'
			};
		}
		return null;
	}

	const linkHandlers: ProfileLinkHandlers = {
		lookup: lookupProfileUser,
		open: openProfile
	};

	return {
		get sideTarget() {
			return sideTarget;
		},
		get dialogCard() {
			return dialogCard;
		},
		get sideCard() {
			return sideCard;
		},
		get chatPartnerCard() {
			return chatPartnerCard;
		},
		get closingInPlace() {
			return closingInPlace;
		},
		get directOpening() {
			return directOpening;
		},
		linkHandlers,
		closeSideProfile,
		openProfile,
		errorFor,
		befriend,
		messageUser,
		unfriendActionFor,
		finishUnfriend,
		shareActionFor,
		shareProfile
	};
}
