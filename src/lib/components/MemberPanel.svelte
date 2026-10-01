<script lang="ts">
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { crossfade, fade } from 'svelte/transition';
	import type { Member } from '$lib/servers/members';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import MemberItem from './MemberItem.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		members: Member[];
		loading?: boolean;
		onopenprofile?: (member: Member, source: HTMLElement | null) => void;
	}

	let { members, loading = false, onopenprofile }: Props = $props();

	const skeletonRows = [
		{ opacity: 1, width: 58 },
		{ opacity: 0.8, width: 44 },
		{ opacity: 0.6, width: 66 },
		{ opacity: 0.4, width: 50 },
		{ opacity: 0.22, width: 38 }
	];

	const skeleton = createDelayedFlag(() => loading);

	const moveMs = 250;
	const motionMs = $derived(prefersReducedMotion.current ? 0 : moveMs);
	const [send, receive] = crossfade({
		duration: () => (prefersReducedMotion.current ? 0 : moveMs),
		easing: cubicOut,
		fallback: (node) => fade(node, { duration: prefersReducedMotion.current ? 0 : 150 })
	});

	const byOwnerFirst =(a: Member, b: Member) => Number(b.owner) - Number(a.owner);

	const online = $derived(members.filter((m) => m.online).sort(byOwnerFirst));
	const offline = $derived(members.filter((m) => !m.online).sort(byOwnerFirst));
</script>

<aside class="panel flex min-h-0 flex-1 flex-col">
	<div class="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
		<h2 class="min-w-0 truncate text-[20px] leading-6 font-bold tracking-[-0.01em] text-ink">
			Участники
		</h2>
		<span
			class="text-[12px] text-muted transition-opacity duration-150 {loading
				? 'opacity-0'
				: 'opacity-100'}">{members.length}</span
		>
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<SmoothScroll scrollbar class="min-h-0 flex-1" contentClass="grid px-2.5 py-3">
		{#if skeleton.current}
			<div
				aria-hidden="true"
				class="col-start-1 row-start-1"
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
		{:else if !loading}
			<div class="col-start-1 row-start-1" in:fade={{ duration: 150 }}>
				{@render group('В сети', online)}
				{@render group('Не в сети', offline)}
			</div>
		{/if}
	</SmoothScroll>
</aside>

{#snippet group(label: string, list: Member[])}
	<div class={list.length > 0 ? 'mb-2' : ''}>
		{#if list.length > 0}
			<div
				transition:fade={{ duration: motionMs ? 150 : 0 }}
				class="flex h-7 items-center px-2 text-[13px] font-semibold text-muted"
			>
				{label} — {list.length}
			</div>
		{/if}
		<div class="flex flex-col gap-0.5 {list.length > 0 ? 'pt-0.5' : ''}">
			{#each list as member (member.id)}
				<div
					in:receive={{ key: member.id }}
					out:send={{ key: member.id }}
					animate:flip={{ duration: motionMs, easing: cubicOut }}
				>
					<MemberItem {member} onopenprofile={(source) => onopenprofile?.(member, source)} />
				</div>
			{/each}
		</div>
	</div>
{/snippet}
