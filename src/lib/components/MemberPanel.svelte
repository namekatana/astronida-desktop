<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Member } from '$lib/servers/members';
	import MemberItem from './MemberItem.svelte';

	interface Props {
		members: Member[];
		loading?: boolean;
	}

	let { members, loading = false }: Props = $props();

	const skeletonRows = [
		{ opacity: 1, width: 58 },
		{ opacity: 0.8, width: 44 },
		{ opacity: 0.6, width: 66 },
		{ opacity: 0.4, width: 50 },
		{ opacity: 0.22, width: 38 }
	];

	const byOwnerFirst = (a: Member, b: Member) => Number(b.owner) - Number(a.owner);

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

	<div class="scrollbar-none grid min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
		{#if loading}
			<div aria-hidden="true" class="col-start-1 row-start-1" out:fade={{ duration: 120 }}>
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
		{:else}
			<div class="col-start-1 row-start-1" in:fade={{ duration: 150 }}>
				{@render group('В сети', online)}
				{@render group('Не в сети', offline)}
			</div>
		{/if}
	</div>
</aside>

{#snippet group(label: string, list: Member[])}
	{#if list.length > 0}
		<div class="mb-2">
			<div class="flex h-7 items-center px-2 text-[13px] font-semibold text-muted">
				{label} — {list.length}
			</div>
			<div class="flex flex-col gap-0.5 pt-0.5">
				{#each list as member (member.id)}
					<MemberItem {member} />
				{/each}
			</div>
		</div>
	{/if}
{/snippet}
