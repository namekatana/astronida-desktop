import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { workspaceCache } from '$lib/cache/workspace-cache';
import type { Feeds } from '$lib/messages/feeds.svelte';
import { previewText } from '$lib/messages/messages';
import { typingIn } from '$lib/messages/typing.svelte';
import { requestAttention, showNotification } from '$lib/notifications/notify';
import { playFriendRequestSound } from '$lib/notifications/sounds';
import { ownStatus } from '$lib/presence/own-status.svelte';
import type { PresenceStatus } from '$lib/presence/status';
import { unread } from '$lib/notifications/unread.svelte';
import { windowFocus } from '$lib/ui/window-focus.svelte';
import { subscribeToFriends } from './channel';
import type { Friend, FriendActivity } from './friends';

const freshFriendMs = 1000;

export function createFriendsState(input: {
	userId: string;
	friends: Friend[];
	online: Set<string>;
	feeds: Feeds;
	persist: (friends: Friend[]) => void;
}) {
	let list = $state<Friend[]>(input.friends);
	let online = $state<Map<string, PresenceStatus>>(
		new Map([...input.online].map((userId) => [userId, 'online' as const]))
	);
	let requests = $state<Friend[]>([]);
	const freshRequestIds = new SvelteSet<string>();
	const freshFriendIds = new SvelteSet<string>();

	function addFriend(friend: Friend) {
		const known = list.find((existing) => existing.id === friend.id);
		if (known) {
			known.channelId ??= friend.channelId;
			return;
		}
		freshFriendIds.add(friend.id);
		setTimeout(() => freshFriendIds.delete(friend.id), freshFriendMs);
		list = [...list, friend];
		input.persist(list);
	}

	function changeAvatar(friendId: string, avatarId: string | null) {
		if (!list.some((friend) => friend.id === friendId)) return;
		list = list.map((friend) => (friend.id === friendId ? { ...friend, avatarId } : friend));
		input.persist(list);
	}

	function handleRequestReceived(request: Friend) {
		freshRequestIds.add(request.id);
		if (ownStatus.quiet) return;
		playFriendRequestSound();
		if (windowFocus.active) return;
		void showNotification({
			title: 'Запрос в друзья',
			body: `@${request.username} хочет добавить вас в друзья`,
			target: { kind: 'requests' }
		});
		void requestAttention();
	}

	$effect(() => {
		return subscribeToFriends({
			userId: input.userId,
			onOnline: (next) => {
				online = next;
				workspaceCache.saveFriendsOnline(input.userId, new Set(next.keys()));
			},
			onRequests: (next) => (requests = next),
			onRequestReceived: handleRequestReceived,
			onFriendAdded: addFriend,
			onFriendAvatar: changeAvatar
		});
	});

	const ids = $derived(new Set(list.map((friend) => friend.id)));

	const withPresence = $derived(
		list.map((friend) => ({
			...friend,
			online: online.has(friend.id),
			status: online.get(friend.id) ?? 'online',
			owner: false
		}))
	);

	const directChannelIds = $derived(
		list.flatMap((friend) => (friend.channelId ? [friend.channelId] : []))
	);

	$effect(() => {
		const channelIds = directChannelIds;
		untrack(() => input.feeds.loadLatest(channelIds));
	});

	const activity = $derived(
		Object.fromEntries(
			list.flatMap((friend): [string, FriendActivity][] => {
				const channelId = friend.channelId;
				if (!channelId) return [];
				if (typingIn(channelId).includes(friend.id)) return [[friend.id, { kind: 'typing' }]];
				const latest = input.feeds.latestOf(channelId);
				if (!latest) return [];
				return [
					[
						friend.id,
						{
							kind: 'message',
							text: previewText(latest.text),
							own: latest.author.id === input.userId
						}
					]
				];
			})
		)
	);

	const unreadCounts = $derived(
		Object.fromEntries(
			list.flatMap((friend) => {
				const count = friend.channelId ? unread.directCount(friend.channelId) : 0;
				return count > 0 ? [[friend.id, count]] : [];
			})
		)
	);

	return {
		get list() {
			return list;
		},
		set list(next: Friend[]) {
			list = next;
		},
		get requests() {
			return requests;
		},
		get ids() {
			return ids;
		},
		get withPresence() {
			return withPresence;
		},
		get activity() {
			return activity;
		},
		get unreadCounts() {
			return unreadCounts;
		},
		freshRequestIds,
		freshFriendIds
	};
}
