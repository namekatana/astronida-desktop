<script lang="ts">
	import type { VoiceOccupant } from './occupant';
	import Avatar from '$lib/profile/Avatar.svelte';

	interface Props {
		members: VoiceOccupant[];
		max?: number;
	}

	let { members, max = 4 }: Props = $props();

	const visible = $derived(members.length > max ? members.slice(0, max - 1) : members);
	const hidden = $derived(members.length - visible.length);
</script>

<div class="flex -space-x-2">
	{#each visible as member (member.id)}
		<span class="flex" title="@{member.username}{member.quality === 'lost' ? ' · связь потеряна' : ''}">
			<Avatar
				name={member.name}
				size={24}
				userId={member.id}
				avatarId={member.avatarId}
				class="border-2 transition-[border-color,opacity] duration-150 {member.speaking
					? 'border-online'
					: 'border-surface'} {member.quality === 'lost' ? 'animate-pulse opacity-40' : ''}"
			/>
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
