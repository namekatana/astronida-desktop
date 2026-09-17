<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import MemberItem from './MemberItem.svelte';

	interface Props {
		members: Member[];
	}

	let { members }: Props = $props();

	const byOwnerFirst = (a: Member, b: Member) => Number(b.owner) - Number(a.owner);

	const online = $derived(members.filter((m) => m.online).sort(byOwnerFirst));
	const offline = $derived(members.filter((m) => !m.online).sort(byOwnerFirst));
</script>

<aside class="panel flex min-h-0 flex-1 flex-col">
	<div class="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
		<h2 class="min-w-0 truncate text-[15px] font-semibold text-ink">Участники</h2>
		<span class="text-[12px] text-muted">{members.length}</span>
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<div class="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
		{#snippet group(label: string, list: Member[])}
			{#if list.length > 0}
				<div class="mb-2">
					<div class="flex h-7 items-center px-2 text-[11px] font-medium tracking-[0.1em] text-muted uppercase">
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

		{@render group('В сети', online)}
		{@render group('Не в сети', offline)}
	</div>
</aside>
