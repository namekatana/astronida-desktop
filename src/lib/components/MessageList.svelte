<script lang="ts">
	import type { Message } from '$lib/messages/messages';
	import MessageGroup from './MessageGroup.svelte';
	import Scrollbar from './Scrollbar.svelte';

	interface Props {
		messages: Message[];
		hasMore?: boolean;
		loading?: boolean;
		onloadolder?: () => void;
		onretry?: (messageId: string) => void;
	}

	let { messages, hasMore = false, loading = false, onloadolder, onretry }: Props = $props();

	const groupGapMs = 5 * 60 * 1000;

	type Group = { key: string; messages: Message[] };
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
			const continues =
				last &&
				last.author.id === message.author.id &&
				message.sentAt.getTime() - last.sentAt.getTime() <= groupGapMs;

			if (group && continues) group.messages.push(message);
			else block.groups.push({ key: message.id, messages: [message] });
		}
		return result;
	});

	let scroller = $state<HTMLDivElement>();

	let heightBeforePrepend: number | null = null;

	$effect(() => {
		void blocks;
		if (!scroller) return;
		if (heightBeforePrepend !== null) {
			scroller.scrollTop += scroller.scrollHeight - heightBeforePrepend;
			heightBeforePrepend = null;
		} else {
			scroller.scrollTop = scroller.scrollHeight;
		}
	});

	const loadOlderThreshold = 48;

	function handleScroll() {
		if (!scroller || !hasMore || loading || scroller.scrollTop > loadOlderThreshold) return;
		heightBeforePrepend = scroller.scrollHeight;
		onloadolder?.();
	}
</script>

<div class="panel-deep relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div
		bind:this={scroller}
		onscroll={handleScroll}
		class="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3"
	>
		{#if messages.length === 0 && !loading}
			<div class="flex flex-1 items-center justify-center">
				<span class="text-[13px] text-muted">Пока пусто — напиши первым</span>
			</div>
		{/if}

		{#each blocks as block (block.dateLabel)}
			<div class="flex items-center gap-3 px-3 py-3">
				<span class="h-px flex-1 bg-surface-line"></span>
				<span class="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">{block.dateLabel}</span>
				<span class="h-px flex-1 bg-surface-line"></span>
			</div>

			<div class="flex flex-col gap-1">
				{#each block.groups as group (group.key)}
					<MessageGroup messages={group.messages} {onretry} />
				{/each}
			</div>
		{/each}
	</div>
	<Scrollbar target={scroller} />
</div>
