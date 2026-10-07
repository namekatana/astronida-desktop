import type { Feeds } from '$lib/messages/feeds.svelte';
import { previewText } from '$lib/messages/messages';
import { typingIn } from '$lib/messages/typing.svelte';
import type { FriendActivity } from './friends';

export function chatActivity(input: {
	feeds: Feeds;
	selfId: string;
	partnerId: string;
	channelId: string;
}): FriendActivity | undefined {
	if (typingIn(input.channelId).includes(input.partnerId)) return { kind: 'typing' };
	const latest = input.feeds.latestOf(input.channelId);
	if (!latest) return undefined;
	return {
		kind: 'message',
		text: previewText(latest.text),
		own: latest.author.id === input.selfId
	};
}
