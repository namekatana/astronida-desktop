import type { Message } from '$lib/messages/messages';
import { clearTyping, markTyping } from '$lib/messages/typing.svelte';
import type { Sync } from '$lib/sync/sync';
import { windowFocus } from '$lib/ui/window-focus.svelte';
import { markRead, subscribeToInbox, type UnreadSnapshot } from './inbox';
import { onNotificationActivated, requestAttention, showNotification } from './notify';
import { playDirectMessageSound } from './sounds';
import { setTaskbarBadge } from './taskbar';
import { unread } from './unread.svelte';

export function createIncoming(input: {
	userId: string;
	sync: Sync;
	openChatId: () => string | null;
	isTextChannel: (serverId: string, channelId: string) => boolean;
	requestCount: () => number;
	onOpenHome: (directChannelId: string | null) => void;
}) {
	const { sync } = input;

	function isViewing(channelId: string): boolean {
		return input.openChatId() === channelId && windowFocus.active;
	}

	function handleSnapshot(snapshot: UnreadSnapshot) {
		unread.replace(snapshot);
		void sync.synchronize(snapshot);
	}

	function handleDirectMessage(channelId: string, message: Message) {
		clearTyping(channelId, message.author.id);
		sync.receive(channelId, message);
		if (isViewing(channelId)) {
			markRead(channelId, message.id);
			return;
		}
		unread.addDirect(channelId, message.id);
		playDirectMessageSound();
		if (windowFocus.active) return;
		void showNotification({
			title: `@${message.author.username}`,
			body: message.text,
			target: { kind: 'direct', channelId }
		});
		void requestAttention();
	}

	function handleChannelMessage(serverId: string, channelId: string, message: Message) {
		sync.receive(channelId, message);
		if (message.author.id === input.userId) return;
		if (!input.isTextChannel(serverId, channelId)) return;
		if (isViewing(channelId)) {
			markRead(channelId, message.id);
			return;
		}
		unread.addChannel(channelId, message.id);
	}

	$effect(() => {
		return subscribeToInbox({
			userId: input.userId,
			onSnapshot: handleSnapshot,
			onDirectMessage: handleDirectMessage,
			onRead: (channelId, messageId) => unread.clear(channelId, messageId),
			onTyping: markTyping
		});
	});

	$effect(() => {
		const channelId = input.openChatId();
		if (!channelId || !windowFocus.active) return;
		const newest = unread.newestFor(channelId);
		if (!newest) return;
		markRead(channelId, newest);
		unread.clear(channelId, newest);
	});

	$effect(() => {
		return onNotificationActivated((target) =>
			input.onOpenHome(target.kind === 'direct' ? target.channelId : null)
		);
	});

	const homeBadge = $derived(unread.directTotal + input.requestCount());

	$effect(() => {
		void setTaskbarBadge(homeBadge);
	});

	$effect(() => {
		return () => {
			sync.stop();
			unread.reset();
			void setTaskbarBadge(0);
		};
	});

	return {
		handleChannelMessage,
		get homeBadge() {
			return homeBadge;
		}
	};
}
