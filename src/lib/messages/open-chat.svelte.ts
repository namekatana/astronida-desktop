import { untrack } from 'svelte';
import { unread, type UnreadMark } from '$lib/notifications/unread.svelte';
import type { Sync } from '$lib/sync/sync';
import type { Feeds } from './feeds.svelte';
import { sendTyping, subscribeToChannel, type Message } from './messages';
import { clearTyping, createTypingSender, markTyping } from './typing.svelte';

function firstUnreadId(messages: Message[], mark: UnreadMark, hasMore: boolean): string | null {
	const confirmed = messages.filter((message) => message.status === undefined);
	if ('from' in mark) return confirmed.find((message) => message.id >= mark.from)?.id ?? null;
	const after = mark.after;
	const boundaryLoaded =
		!hasMore || (after !== null && confirmed.some((message) => message.id <= after));
	if (!boundaryLoaded) return null;
	return confirmed.find((message) => after === null || message.id > after)?.id ?? null;
}

export function createOpenChat(input: {
	userId: string;
	feeds: Feeds;
	sync: Sync;
	chatId: () => string | null;
}) {
	const { feeds, sync } = input;
	let loading = $state(false);

	const messages = $derived.by((): Message[] => {
		const channelId = input.chatId();
		return channelId ? feeds.messagesOf(channelId) : [];
	});

	const hasMore = $derived.by(() => {
		const channelId = input.chatId();
		return channelId ? feeds.hasMoreOf(channelId) : false;
	});

	let unreadMark = $state<UnreadMark | null>(null);
	let markedChatId: string | null = null;

	$effect(() => {
		const channelId = input.chatId();
		const pending = channelId ? unread.markFor(channelId) : null;
		if (channelId !== markedChatId) {
			markedChatId = channelId;
			unreadMark = pending;
			return;
		}
		if (pending && 'after' in pending && !untrack(() => unreadMark)) unreadMark = pending;
	});

	const dividerId = $derived(unreadMark ? firstUnreadId(messages, unreadMark, hasMore) : null);

	$effect(() => {
		const channelId = input.chatId();
		loading = false;
		if (!channelId) return;

		let stale = false;
		sync.markWarm(channelId);
		untrack(() => feeds.feedFor(channelId));
		loading = untrack(() => !feeds.isLoaded(channelId));
		const opened = untrack(() => feeds.open(channelId))
			.then(() => {
				if (!stale && feeds.isLoaded(channelId)) loading = false;
				return feeds.sync(channelId);
			})
			.then(() => {
				if (!stale) loading = false;
			});
		const unsubscribe = subscribeToChannel({
			channelId,
			onMessage: (message) => {
				if (stale) return;
				clearTyping(channelId, message.author.id);
				feeds.absorb(channelId, [message]);
			},
			onTyping: (userId) => {
				if (!stale && userId !== input.userId) markTyping(channelId, userId);
			},
			onReady: () => {
				opened.then(() => {
					if (!stale) void feeds.sync(channelId);
				});
			}
		});
		return () => {
			stale = true;
			unsubscribe();
		};
	});

	async function loadOlder() {
		const channelId = input.chatId();
		const oldest = messages[0];
		if (!channelId || !oldest || loading || !hasMore) return;

		loading = true;
		await feeds.loadOlder(channelId, oldest.id);
		if (input.chatId() === channelId) loading = false;
	}

	const typingSender = createTypingSender(() => {
		const channelId = input.chatId();
		if (channelId) sendTyping(channelId);
	});

	$effect(() => {
		void input.chatId();
		typingSender.reset();
	});

	return {
		get messages() {
			return messages;
		},
		get hasMore() {
			return hasMore;
		},
		get loading() {
			return loading;
		},
		get dividerId() {
			return dividerId;
		},
		loadOlder,
		touchTyping: typingSender.touch,
		resetTyping: typingSender.reset
	};
}
