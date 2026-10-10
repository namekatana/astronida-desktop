import { untrack } from 'svelte';
import { chatActivity } from '$lib/friends/activity';
import type { Friend, FriendActivity } from '$lib/friends/friends';
import type { Feeds } from '$lib/messages/feeds.svelte';
import type { MessageAuthor } from '$lib/messages/messages';
import { unread } from '$lib/notifications/unread.svelte';
import type { Member } from '$lib/servers/members';
import { visibleConversations } from './conversation-list';

export type Conversations = ReturnType<typeof createConversations>;

function samePartner(a: Friend, b: Friend): boolean {
	return (
		a.channelId === b.channelId &&
		a.username === b.username &&
		a.name === b.name &&
		a.avatarId === b.avatarId
	);
}

export function createConversations(input: {
	userId: string;
	initial: Friend[];
	feeds: Feeds;
	friendIds: () => ReadonlySet<string>;
	persist: () => void;
}) {
	let partners = $state<Friend[]>(input.initial);

	function remember(partner: Friend) {
		const known = partners.find((existing) => existing.id === partner.id);
		if (known && samePartner(known, partner)) return;
		partners = [...partners.filter((existing) => existing.id !== partner.id), partner];
		input.persist();
	}

	function learnFromMessage(channelId: string, author: MessageAuthor) {
		if (author.id === input.userId) return;
		if (partners.some((partner) => partner.channelId === channelId)) return;
		remember({
			id: author.id,
			username: author.username,
			name: author.name,
			avatarId: author.avatarId ?? null,
			channelId
		});
	}

	function find(userId: string): Friend | undefined {
		return partners.find((partner) => partner.id === userId);
	}

	function findByChannel(channelId: string): Friend | undefined {
		return partners.find((partner) => partner.channelId === channelId);
	}

	const channelIds = $derived(
		partners.flatMap((partner) => (partner.channelId ? [partner.channelId] : []))
	);

	$effect(() => {
		const ids = channelIds;
		untrack(() => input.feeds.loadLatest(ids));
	});

	const visible = $derived(
		visibleConversations({
			partners,
			friendIds: input.friendIds(),
			newestIdOf: (channelId) => input.feeds.latestOf(channelId)?.id
		})
	);

	const members = $derived(
		visible.map((partner): Member => ({ ...partner, online: false, owner: false }))
	);

	const activity = $derived(
		Object.fromEntries(
			visible.flatMap((partner): [string, FriendActivity][] => {
				if (!partner.channelId) return [];
				const current = chatActivity({
					feeds: input.feeds,
					selfId: input.userId,
					partnerId: partner.id,
					channelId: partner.channelId
				});
				return current ? [[partner.id, current]] : [];
			})
		)
	);

	const unreadCounts = $derived(
		Object.fromEntries(
			visible.flatMap((partner) => {
				const count = partner.channelId ? unread.directCount(partner.channelId) : 0;
				return count > 0 ? [[partner.id, count]] : [];
			})
		)
	);

	return {
		get list() {
			return partners;
		},
		set list(next: Friend[]) {
			partners = next;
		},
		get visible() {
			return visible;
		},
		get members() {
			return members;
		},
		get activity() {
			return activity;
		},
		get unreadCounts() {
			return unreadCounts;
		},
		remember,
		learnFromMessage,
		find,
		findByChannel
	};
}
