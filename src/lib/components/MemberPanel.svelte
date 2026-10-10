<script lang="ts">
	import { on } from 'svelte/events';
	import { fade } from 'svelte/transition';
	import type { UserStatus } from '$lib/presence/status';
	import {
		createMemberList,
		type MemberListPreview,
		type MemberRow
	} from '$lib/servers/member-list.svelte';
	import type { Member } from '$lib/servers/members';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import MemberItem from './MemberItem.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		serverId: string;
		ownerId: string;
		selfId: string;
		selfStatus: UserStatus;
		preview: MemberListPreview | null;
		onpreview: (preview: MemberListPreview) => void;
		onopenprofile?: (member: Member, source: HTMLElement | null) => void;
		onmembermenu?: (member: Member, source: HTMLElement | null, event: MouseEvent) => void;
	}

	let {
		serverId,
		ownerId,
		selfId,
		selfStatus,
		preview,
		onpreview,
		onopenprofile,
		onmembermenu
	}: Props = $props();

	const paddingTop = 12;
	const headerHeight = 28;
	const groupGap = 8;
	const rowStride = 42;
	const overscanRows = 8;

	const skeletonWidths = [58, 44, 66, 50, 38, 62, 47, 55];
	const skeletonMinimumRows = 5;

	// svelte-ignore state_referenced_locally
	const list = createMemberList({ serverId, preview, onPreview: onpreview });
	const skeleton = createDelayedFlag(() => !list.loaded);

	let viewport = $state<HTMLDivElement>();
	let scrollTop = $state(0);
	let viewportHeight = $state(0);

	const serverOnline = $derived(list.counts.online);
	const serverOffline = $derived(list.counts.offline ?? 0);
	const strayIndex = $derived.by(() => {
		if (selfStatus === 'invisible') return null;
		for (let index = serverOnline; index < serverOnline + serverOffline; index++) {
			if (list.rowAt(index)?.id === selfId) return index;
		}
		return null;
	});
	function sortsBefore(row: MemberRow, other: MemberRow): boolean {
		const rank = row.id === ownerId ? 0 : 1;
		const otherRank = other.id === ownerId ? 0 : 1;
		if (rank !== otherRank) return rank < otherRank;
		if (row.username !== other.username) return row.username < other.username;
		return row.id < other.id;
	}

	const selfSlot = $derived.by(() => {
		const self = strayIndex === null ? null : list.rowAt(strayIndex);
		if (!self) return 0;
		for (let index = 0; index < serverOnline; index++) {
			const row = list.rowAt(index);
			if (!row || !sortsBefore(row, self)) return index;
		}
		return serverOnline;
	});
	const skeletonRows = $derived.by(() => {
		const count = Math.max(
			skeletonMinimumRows,
			Math.floor((viewportHeight - paddingTop * 2 - headerHeight) / rowStride)
		);
		return Array.from({ length: count }, (_, index) => ({
			width: skeletonWidths[index % skeletonWidths.length],
			opacity: 1 - (index / count) * 0.85
		}));
	});
	const online = $derived(strayIndex === null ? serverOnline : serverOnline + 1);
	const offline = $derived(strayIndex === null ? serverOffline : serverOffline - 1);
	const showsOffline = $derived(list.counts.offline !== null && offline > 0);
	const total = $derived(online + (showsOffline ? offline : 0));
	const onlineHeader = $derived(online > 0 ? headerHeight : 0);
	const offlineTop = $derived(
		paddingTop + onlineHeader + online * rowStride + (online > 0 ? groupGap : 0)
	);
	const contentHeight = $derived(
		showsOffline
			? offlineTop + headerHeight + offline * rowStride + paddingTop
			: paddingTop + onlineHeader + online * rowStride + paddingTop
	);

	function topOf(index: number): number {
		if (index < online) return paddingTop + onlineHeader + index * rowStride;
		return offlineTop + headerHeight + (index - online) * rowStride;
	}

	function indexAt(y: number): number {
		const onlineEnd = paddingTop + onlineHeader + online * rowStride;
		if (y < onlineEnd || !showsOffline) {
			return Math.floor((y - paddingTop - onlineHeader) / rowStride);
		}
		return online + Math.floor((y - offlineTop - headerHeight) / rowStride);
	}

	const range = $derived.by(() => {
		if (total === 0) return { first: 0, last: -1 };
		const first = Math.max(0, indexAt(scrollTop) - overscanRows);
		const last = Math.min(total - 1, indexAt(scrollTop + viewportHeight) + overscanRows);
		return { first, last: Math.max(first, last) };
	});

	function shownRowAt(index: number): MemberRow | null {
		if (strayIndex === null) return list.rowAt(index);
		if (index === selfSlot) return list.rowAt(strayIndex);
		if (index < online) return list.rowAt(index < selfSlot ? index : index - 1);
		const serverIndex = index - 1;
		return list.rowAt(serverIndex >= strayIndex ? serverIndex + 1 : serverIndex);
	}

	const slots = $derived.by(() => {
		const visible: { index: number; row: MemberRow | null }[] = [];
		for (let index = range.first; index <= range.last; index++) {
			visible.push({ index, row: shownRowAt(index) });
		}
		return visible;
	});

	function memberOf(row: MemberRow): Member {
		const status = row.id === selfId ? (selfStatus === 'invisible' ? null : selfStatus) : row.status;
		return {
			id: row.id,
			username: row.username,
			name: row.name,
			avatarId: row.avatarId,
			online: status !== null,
			status: status ?? undefined,
			owner: row.id === ownerId
		};
	}

	$effect(() => {
		list.setViewport(range.first, range.last);
	});

	$effect(() => {
		const target = viewport;
		if (!target) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			scrollTop = target.scrollTop;
			viewportHeight = target.clientHeight;
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		const observer = new ResizeObserver(schedule);
		observer.observe(target);
		const offScroll = on(target, 'scroll', schedule, { passive: true });
		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer.disconnect();
			offScroll();
		};
	});

	$effect(() => {
		return () => list.destroy();
	});
</script>

<aside class="panel flex min-h-0 flex-1 flex-col">
	<div class="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
		<h2 class="min-w-0 truncate text-[20px] leading-6 font-bold tracking-[-0.01em] text-ink">
			Участники
		</h2>
		{#if list.loaded && list.counts.offline !== null}
			<span class="text-[12px] text-muted" in:fade={{ duration: 150 }}>
				{online + offline}
			</span>
		{/if}
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<SmoothScroll scrollbar bind:viewport class="min-h-0 flex-1" contentClass="relative px-2.5">
		{#if skeleton.current}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-2.5 top-0 py-3"
				in:fade={{ duration: 150 }}
				out:fade={{ duration: 120 }}
			>
				<div class="flex h-7 items-center px-2">
					<span class="skeleton h-2 w-16 rounded-full"></span>
				</div>
				<div class="flex flex-col gap-0.5 pt-0.5">
					{#each skeletonRows as row, index (index)}
						<div class="flex h-10 items-center gap-2.5 px-2.5" style="opacity: {row.opacity}">
							<span class="skeleton h-7 w-7 shrink-0 rounded-full"></span>
							<span class="skeleton h-2.5 rounded-full" style="width: {row.width}%"></span>
						</div>
					{/each}
				</div>
			</div>
		{:else if list.loaded}
			<div class="relative" style="height: {contentHeight}px" in:fade={{ duration: 150 }}>
				{#if online > 0}
					{@render header(`В сети — ${online}`, paddingTop)}
				{/if}
				{#if showsOffline}
					{@render header(`Не в сети — ${offline}`, offlineTop)}
				{/if}
				{#each slots as slot (slot.row?.id ?? `slot-${slot.index}`)}
					<div class="absolute inset-x-0" style="top: {topOf(slot.index)}px">
						{#if slot.row}
							{@const member = memberOf(slot.row)}
							<MemberItem
								{member}
								onopenprofile={(source) => onopenprofile?.(member, source)}
								onmenu={onmembermenu
									? (source, event) => onmembermenu(member, source, event)
									: undefined}
							/>
						{:else}
							<div class="flex h-10 items-center gap-2.5 px-2.5" aria-hidden="true">
								<span class="skeleton h-7 w-7 shrink-0 rounded-full"></span>
								<span class="skeleton h-2.5 w-1/2 rounded-full"></span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</SmoothScroll>
</aside>

{#snippet header(label: string, top: number)}
	<div
		class="absolute inset-x-0 flex h-7 items-center px-2 text-[13px] font-semibold text-muted"
		style="top: {top}px"
	>
		{label}
	</div>
{/snippet}
