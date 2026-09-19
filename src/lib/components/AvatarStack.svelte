<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';

	interface Props {
		members: Member[];
		max?: number;
	}

	let { members, max = 4 }: Props = $props();

	const visible = $derived(members.length > max ? members.slice(0, max - 1) : members);
	const hidden = $derived(members.length - visible.length);
</script>

<div class="flex -space-x-2">
	{#each visible as member (member.id)}
		<span
			title="@{member.username}"
			class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-raised text-[10px] font-medium text-ink"
		>
			{initials(member.name)}
		</span>
	{/each}
	{#if hidden > 0}
		<span
			class="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-raised px-1 text-[10px] font-medium text-muted tabular-nums"
		>
			+{hidden}
		</span>
	{/if}
</div>
