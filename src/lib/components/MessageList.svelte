<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { renderKeyOf, type Message, type MessageAuthor } from '$lib/messages/messages';
	import type { Server } from '$lib/servers/servers';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import type { SmoothScrollController } from '$lib/ui/smooth-scroll';
	import type { MessageMenuMode } from './message-menu';
	import MessageGroup from './MessageGroup.svelte';
	import MessageMenu from './MessageMenu.svelte';
	import MessageSkeleton from './MessageSkeleton.svelte';
	import SmoothScroll from './SmoothScroll.svelte';
	import Toast from './Toast.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	interface Props {
		messages: Message[];
		selfId: string;
		hasMore?: boolean;
		loading?: boolean;
		typing?: string[];
		dividerId?: string | null;
		onloadolder?: () => void;
		oncancel?: (messageId: string) => void;
		onreply?: (message: Message) => void;
		onedit?: (message: Message) => void;
		onforward?: (message: Message) => void;
		onjoinedinvite?: (server: Server) => void;
		onopeninvite?: (code: string) => void;
		onopenphoto?: (message: Message, index: number, element: HTMLElement) => void;
		onopenprofile?: (author: MessageAuthor, source: HTMLElement | null) => void;
		pinnedIds?: Set<string>;
		onpin?: (message: Message) => void;
		oncopy?: (message: Message) => void;
		ondelete?: (message: Message) => void;
		onsavephoto?: (message: Message, index: number) => void;
		onsaveallphotos?: (message: Message) => void;
		canDeleteOthers?: boolean;
		top?: Snippet;
	}

	let {
		messages,
		selfId,
		hasMore = false,
		loading = false,
		typing = [],
		dividerId = null,
		onloadolder,
		oncancel,
		onreply,
		onedit,
		onforward,
		onjoinedinvite,
		onopeninvite,
		onopenphoto,
		onopenprofile,
		pinnedIds,
		onpin,
		oncopy,
		ondelete,
		onsavephoto,
		onsaveallphotos,
		canDeleteOthers = false,
		top
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
				!message.replyTo &&
				last &&
				last.author.id === message.author.id &&
				message.sentAt.getTime() - last.sentAt.getTime() <= groupGapMs;

			if (group && continues) group.messages.push(message);
			else block.groups.push({ key: renderKeyOf(message), messages: [message], unreadStart });
		}
		return result;
	});

	const skeleton = createDelayedFlag(() => loading && messages.length === 0);

	let scroller = $state<HTMLDivElement>();
	let controller = $state<SmoothScrollController>();
	let menu = $state<{
		message: Message;
		mode: MessageMenuMode;
		photoIndex: number | null;
		x: number;
		y: number;
	} | null>(null);
	let flashId = $state<string | null>(null);

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
		if (!scroller || menu) return;
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
			if (pinnedToBottom && !menu) scrollToBottom(element);
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

	function messageAt(target: EventTarget | null): Message | undefined {
		if (!(target instanceof Element)) return undefined;
		const row = target.closest<HTMLElement>('[data-message-id]');
		const messageId =
			row?.dataset.messageId ?? target.closest<HTMLElement>('[data-group-first]')?.dataset.groupFirst;
		return messageId ? messages.find((message) => message.id === messageId) : undefined;
	}

	function menuModeFor(message: Message): MessageMenuMode | null {
		if (message.status !== undefined) return oncancel ? 'pending' : null;
		if (message.author.id === selfId) return onreply ? 'own' : null;
		return 'received';
	}

	function photoIndexAt(target: EventTarget | null, message: Message): number | null {
		const attachments = message.attachments ?? [];
		if (attachments.length === 1) return 0;
		if (!(target instanceof Element)) return null;
		const attachmentId = target.closest<HTMLElement>('[data-attachment-id]')?.dataset.attachmentId;
		const index = attachments.findIndex((attachment) => attachment.id === attachmentId);
		return index < 0 ? null : index;
	}

	function openMenu(event: MouseEvent) {
		const message = messageAt(event.target);
		const mode = message ? menuModeFor(message) : null;
		if (!message || !mode) return;
		event.preventDefault();
		const photoIndex = mode === 'pending' ? null : photoIndexAt(event.target, message);
		menu = { message, mode, photoIndex, x: event.clientX, y: event.clientY };
	}

	$effect(() => {
		const messageId = menu?.message.id;
		if (messageId && !messages.some((message) => message.id === messageId)) menu = null;
	});

	const jumpableIds = $derived(
		new Set(messages.filter((message) => message.status === undefined).map((message) => message.id))
	);

	function canJumpTo(messageId: string): boolean {
		return jumpableIds.has(messageId);
	}

	export async function jumpTo(messageId: string) {
		const element = scroller;
		const row = element?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
		if (!element || !row || !controller) return;
		const viewport = element.getBoundingClientRect();
		const rowBox = row.getBoundingClientRect();
		const fullyVisible = rowBox.top >= viewport.top && rowBox.bottom <= viewport.bottom;
		if (!fullyVisible) {
			const top = rowBox.top - viewport.top + controller.position;
			controller.scrollTo(Math.max(0, top - (element.clientHeight - rowBox.height) / 2));
		}
		flashId = null;
		await tick();
		flashId = messageId;
	}
</script>

<div class="panel-deep relative flex min-h-0 flex-1 flex-col overflow-hidden">
	{@render top?.()}
	<SmoothScroll
		bind:viewport={scroller}
		bind:controller
		role="log"
		aria-label="Сообщения"
		onscroll={handleScroll}
		oncontextmenu={openMenu}
		disabled={menu !== null}
		scrollbar
		class="min-h-0 flex-1"
		contentClass="flex min-h-full flex-col px-2 pt-3 pb-7"
	>
		{#if messages.length === 0}
			{#if skeleton.current}
				<div
					class="pointer-events-none absolute inset-x-2 bottom-7"
					in:fade={{ duration: 150 }}
					out:fade={{ duration: 120 }}
				>
					<MessageSkeleton />
				</div>
			{:else if !loading}
				<div class="flex flex-1 items-center justify-center" in:fade={{ duration: 150 }}>
					<span class="text-[13px] text-muted">Пока пусто — напиши первым</span>
				</div>
			{/if}
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
					<MessageGroup
						messages={group.messages}
						{selfId}
						highlightedId={menu?.message.id}
						{flashId}
						{canJumpTo}
						onjump={jumpTo}
						onflashend={() => (flashId = null)}
						{onjoinedinvite}
						{onopeninvite}
						{onopenphoto}
						{onopenprofile}
					/>
				{/each}
			</div>
		{/each}
	</SmoothScroll>
	<TypingIndicator names={typing} />
	<Toast />
</div>

{#if menu}
	{@const message = menu.message}
	{@const photoIndex = menu.photoIndex}
	<MessageMenu
		x={menu.x}
		y={menu.y}
		mode={menu.mode}
		onclose={() => (menu = null)}
		oncancel={() => oncancel?.(message.id)}
		onreply={() => onreply?.(message)}
		onedit={onedit && menu.mode === 'own' && !message.forwardedFrom
			? () => onedit(message)
			: undefined}
		onforward={() => onforward?.(message)}
		pinned={pinnedIds?.has(message.id) ?? false}
		onpin={onpin ? () => onpin(message) : undefined}
		oncopy={message.text === '' ? undefined : () => oncopy?.(message)}
		ondelete={ondelete && (menu.mode === 'own' || canDeleteOthers)
			? () => ondelete(message)
			: undefined}
		photoCount={message.attachments?.length ?? 0}
		onsavephoto={onsavephoto && photoIndex !== null
			? () => onsavephoto(message, photoIndex)
			: undefined}
		onsaveallphotos={onsaveallphotos && menu.mode !== 'pending'
			? () => onsaveallphotos(message)
			: undefined}
	/>
{/if}
