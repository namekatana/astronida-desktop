<script lang="ts">
	import type { Message } from '$lib/messages/messages';
	import type { Server } from '$lib/servers/servers';
	import MessageGroup from './MessageGroup.svelte';
	import Scrollbar from './Scrollbar.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	interface Props {
		messages: Message[];
		hasMore?: boolean;
		loading?: boolean;
		typing?: string[];
		dividerId?: string | null;
		onloadolder?: () => void;
		oncancel?: (messageId: string) => void;
		onjoinedinvite?: (server: Server) => void;
	}

	let {
		messages,
		hasMore = false,
		loading = false,
		typing = [],
		dividerId = null,
		onloadolder,
		oncancel,
		onjoinedinvite
	}: Props = $props();

	const groupGapMs = 5 * 60 * 1000;

	type Group = { key: string; messages: Message[]; unreadStart: boolean };
	type Block = { dateLabel: string; groups: Group[] };

	const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

	function dayKey(date: Date): string {
		return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
	}

	function makeDateLabel(): (date: Date) => string {
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(today.getDate() - 1);
		const todayKey = dayKey(today);
		const yesterdayKey = dayKey(yesterday);
		return (date) => {
			const key = dayKey(date);
			if (key === todayKey) return 'Сегодня';
			if (key === yesterdayKey) return 'Вчера';
			return dateFormat.format(date);
		};
	}

	const blocks = $derived.by(() => {
		const dateLabel = makeDateLabel();
		const result: Block[] = [];
		for (const message of messages) {
			const label = dateLabel(message.sentAt);
			let block = result.at(-1);
			if (!block || block.dateLabel !== label) {
				block = { dateLabel: label, groups: [] };
				result.push(block);
			}

			const group = block.groups.at(-1);
			const last = group?.messages.at(-1);
			const unreadStart = message.id === dividerId;
			const continues =
				!unreadStart &&
				last &&
				last.author.id === message.author.id &&
				message.sentAt.getTime() - last.sentAt.getTime() <= groupGapMs;

			if (group && continues) group.messages.push(message);
			else block.groups.push({ key: message.id, messages: [message], unreadStart });
		}
		return result;
	});

	let scroller = $state<HTMLDivElement>();

	let heightBeforePrepend: number | null = null;
	let pinnedToBottom = true;

	const loadOlderThreshold = 48;
	const bottomThreshold = 24;

	function scrollToBottom(element: HTMLDivElement) {
		element.scrollTop = element.scrollHeight;
	}

	let shownList: Message[] | null = null;

	$effect(() => {
		void blocks;
		if (!scroller) return;
		if (shownList !== messages) {
			shownList = messages;
			pinnedToBottom = true;
		}
		if (heightBeforePrepend !== null) {
			scroller.scrollTop += scroller.scrollHeight - heightBeforePrepend;
			heightBeforePrepend = null;
		} else if (pinnedToBottom) {
			scrollToBottom(scroller);
		}
	});

	$effect(() => {
		const element = scroller;
		if (!element) return;
		const observer = new ResizeObserver(() => {
			if (pinnedToBottom) scrollToBottom(element);
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	const dividerOffset = 12;
	let revealedDividerId: string | null = null;

	$effect(() => {
		const id = dividerId;
		const element = scroller;
		if (!element || !id || id === revealedDividerId) return;
		const line = element.querySelector<HTMLElement>('[data-unread-divider]');
		if (!line) return;
		revealedDividerId = id;
		const top =
			line.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop;
		if (element.scrollHeight - top <= element.clientHeight) return;
		element.scrollTop = top - dividerOffset;
		pinnedToBottom = false;
	});

	function handleScroll() {
		if (!scroller) return;
		const distanceToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
		pinnedToBottom = distanceToBottom <= bottomThreshold;
		if (!hasMore || loading || scroller.scrollTop > loadOlderThreshold) return;
		heightBeforePrepend = scroller.scrollHeight;
		onloadolder?.();
	}
</script>

<div class="panel-deep relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div
		bind:this={scroller}
		onscroll={handleScroll}
		class="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-3 pb-7"
	>
		{#if messages.length === 0 && !loading}
			<div class="flex flex-1 items-center justify-center">
				<span class="text-[13px] text-muted">Пока пусто — напиши первым</span>
			</div>
		{/if}

		{#each blocks as block (block.dateLabel)}
			<div class="flex items-center gap-3 px-3 py-3">
				<span class="h-px flex-1 bg-surface-line"></span>
				<span class="text-[13px] font-semibold text-muted">{block.dateLabel}</span>
				<span class="h-px flex-1 bg-surface-line"></span>
			</div>

			<div class="flex flex-col gap-1">
				{#each block.groups as group (group.key)}
					{#if group.unreadStart}
						<div data-unread-divider class="flex items-center gap-3 px-3 py-2">
							<span class="h-px flex-1 bg-white/25"></span>
							<span class="text-[13px] font-semibold text-ink">Новые сообщения</span>
							<span class="h-px flex-1 bg-white/25"></span>
						</div>
					{/if}
					<MessageGroup messages={group.messages} {oncancel} {onjoinedinvite} />
				{/each}
			</div>
		{/each}
	</div>
	<Scrollbar target={scroller} />
	<TypingIndicator names={typing} />
</div>
