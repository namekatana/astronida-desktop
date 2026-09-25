<script lang="ts">
	import { untrack } from 'svelte';
	import { on } from 'svelte/events';
	import { prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import type { Server } from '$lib/servers/servers';
	import Icon from './Icon.svelte';
	import ProfileMenu from './ProfileMenu.svelte';
	import ServerTab from './ServerTab.svelte';
	import UpdateButton from './UpdateButton.svelte';

	interface Props {
		servers: Server[];
		selectedId: string | null;
		username: string | null;
		signingOut?: boolean;
		unreadServerIds: ReadonlySet<string>;
		homeUnread: boolean;
		onselect: (id: string) => void;
		onhome: () => void;
		oncreate: () => void;
		onsignout: () => void;
	}

	let {
		servers,
		selectedId,
		username,
		signingOut = false,
		unreadServerIds,
		homeUnread,
		onselect,
		onhome,
		oncreate,
		onsignout
	}: Props = $props();

	const isHome = $derived(selectedId === null);

	let rowElement = $state<HTMLDivElement | null>(null);
	let tabElements = $state<Record<string, HTMLButtonElement>>({});

	let indicatorLeft = $state(0);
	let indicatorRight = $state(0);
	let leadingEdge = $state<'left' | 'right'>('right');
	let indicatorVisible = $state(false);
	let slide = $state(false);

	function placeIndicator(animate = true) {
		const tab = selectedId ? tabElements[selectedId] : undefined;
		if (!rowElement || !tab) {
			indicatorVisible = false;
			return;
		}

		const rowRect = rowElement.getBoundingClientRect();
		const tabRect = tab.getBoundingClientRect();
		const nextLeft = tabRect.left - rowRect.left;
		const nextRight = rowRect.right - tabRect.right;

		const previousLeft = untrack(() => indicatorLeft);
		slide = animate && untrack(() => indicatorVisible);
		leadingEdge = nextLeft >= previousLeft ? 'right' : 'left';
		indicatorLeft = nextLeft;
		indicatorRight = nextRight;
		indicatorVisible = true;
	}

	const moveTransition = $derived(
		slide && !prefersReducedMotion.current
			? `left 240ms var(--ease-move) ${leadingEdge === 'left' ? '0ms' : '60ms'}, right 240ms var(--ease-move) ${leadingEdge === 'right' ? '0ms' : '60ms'}, `
			: ''
	);

	$effect(() => {
		void selectedId;
		void servers;
		placeIndicator();
	});

	let scrollElement = $state<HTMLDivElement | null>(null);
	let hiddenLeft = $state(false);
	let hiddenRight = $state(false);

	function updateEdges() {
		if (!scrollElement) return;
		const { scrollLeft, scrollWidth, clientWidth } = scrollElement;
		hiddenLeft = scrollLeft > 1;
		hiddenRight = scrollLeft + clientWidth < scrollWidth - 1;
	}

	let scrollTarget = 0;
	let scrollFrame = 0;

	function maxScroll() {
		return scrollElement ? scrollElement.scrollWidth - scrollElement.clientWidth : 0;
	}

	function animateScroll() {
		if (!scrollElement) return;
		const current = scrollElement.scrollLeft;
		const remaining = scrollTarget - current;
		if (Math.abs(remaining) <= 1) {
			scrollElement.scrollLeft = scrollTarget;
			scrollFrame = 0;
			return;
		}
		const step = remaining * 0.18;
		scrollElement.scrollLeft = current + (Math.abs(step) < 1 ? Math.sign(remaining) : step);
		scrollFrame = requestAnimationFrame(animateScroll);
	}

	function scrollSmoothlyTo(left: number) {
		if (!scrollElement) return;
		scrollTarget = Math.min(maxScroll(), Math.max(0, left));
		if (scrollFrame === 0) scrollFrame = requestAnimationFrame(animateScroll);
	}

	function handleWheel(event: WheelEvent) {
		if (!scrollElement || event.deltaY === 0 || event.deltaX !== 0) return;
		if (maxScroll() <= 0) return;
		event.preventDefault();
		const base = scrollFrame === 0 ? scrollElement.scrollLeft : scrollTarget;
		scrollSmoothlyTo(base + event.deltaY);
	}

	const edgeFade = 40;

	function revealSelectedTab() {
		const tab = selectedId ? tabElements[selectedId] : undefined;
		if (!scrollElement || !tab) return;
		const margin = edgeFade;
		const { scrollLeft, clientWidth } = scrollElement;
		const tabLeft = tab.offsetLeft;
		const tabRight = tabLeft + tab.offsetWidth;
		if (tabLeft < scrollLeft + margin) scrollSmoothlyTo(tabLeft - margin);
		else if (tabRight > scrollLeft + clientWidth - margin) scrollSmoothlyTo(tabRight + margin - clientWidth);
	}

	$effect(() => {
		void selectedId;
		revealSelectedTab();
	});

	$effect(() => {
		if (!scrollElement || !rowElement) return;
		const observer = new ResizeObserver(() => {
			updateEdges();
			placeIndicator(false);
		});
		observer.observe(scrollElement);
		observer.observe(rowElement);
		const offWheel = on(scrollElement, 'wheel', handleWheel, { passive: false });
		return () => {
			observer.disconnect();
			offWheel();
			cancelAnimationFrame(scrollFrame);
		};
	});

	const edgeMask = $derived.by(() => {
		if (!hiddenLeft && !hiddenRight) return '';
		const from = hiddenLeft ? `transparent 0, black ${edgeFade}px` : 'black 0';
		const to = hiddenRight ? `black calc(100% - ${edgeFade}px), transparent 100%` : 'black 100%';
		return `mask-image: linear-gradient(to right, ${from}, ${to});`;
	});
</script>

<div class="shrink-0 px-3 pt-3">
	<div class="panel flex items-stretch">
		<div class="flex items-center px-2">
			<button
				type="button"
				aria-label="Друзья"
				aria-pressed={isHome}
				onclick={onhome}
				class="group pressable relative flex h-10 items-center rounded-full px-3 duration-200 ease-soft {isHome
					? 'bg-white/[0.08]'
					: ''}"
			>
				<img
					src="/logo.png"
					alt=""
					class="h-6 w-auto transition-opacity duration-200 ease-soft {isHome
						? 'opacity-100'
						: 'opacity-60 group-hover:opacity-100'}"
				/>
				{#if homeUnread}
					<span
						aria-hidden="true"
						class="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink"
						transition:scale={{ start: 0.8, duration: 160, easing: cubicOut }}
					></span>
				{/if}
			</button>
		</div>

		<div class="my-auto h-5 w-px bg-surface-line"></div>

		<div
			bind:this={scrollElement}
			onscroll={updateEdges}
			style={edgeMask}
			class="scrollbar-none min-w-0 flex-1 overflow-x-auto"
		>
			<div bind:this={rowElement} class="relative flex h-14 w-max items-center gap-1 px-2">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute top-1/2 h-10 -translate-y-1/2 rounded-full bg-ink {indicatorVisible
						? 'opacity-100'
						: 'opacity-0'}"
					style="left: {indicatorLeft}px; right: {indicatorRight}px; transition: {moveTransition}opacity 220ms ease-out;"
				></span>

				{#each servers as server (server.id)}
					<ServerTab
						name={server.name}
						active={server.id === selectedId}
						unread={unreadServerIds.has(server.id)}
						onclick={() => onselect(server.id)}
						bind:element={tabElements[server.id]}
					/>
				{/each}

				<button
					type="button"
					aria-label="Создать сервер"
					onclick={oncreate}
					class="pressable ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted duration-200 hover:border-line-strong hover:text-ink"
				>
					<Icon name="plus" size={14} />
				</button>

				{#if servers.length === 0}
					<div
						transition:fade={{ duration: 160 }}
						class="flex items-center gap-2 pr-2 pl-1 text-[13px] text-muted"
					>
						<Icon name="arrow-right" size={14} class="rotate-180" />
						<span>Добавь свой первый сервер</span>
					</div>
				{/if}
			</div>
		</div>

		<div class="my-auto h-5 w-px bg-surface-line"></div>

		<div class="flex shrink-0 items-center gap-1 pr-3 pl-2">
			<ProfileMenu {username} {signingOut} {onsignout} />
			<UpdateButton />

			<button
				type="button"
				aria-label="Настройки"
				class="pressable flex h-10 w-10 items-center justify-center rounded-full text-muted duration-200 hover:bg-white/[0.06] hover:text-ink"
			>
				<Icon name="gear" size={18} />
			</button>
		</div>
	</div>
</div>
