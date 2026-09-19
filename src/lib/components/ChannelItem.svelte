<script lang="ts">
	import type { Channel } from '$lib/channels/channels';
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';
	import Icon from './Icon.svelte';

	interface Props {
		channel: Channel;
		active?: boolean;
		occupants?: Member[];
		onclick?: () => void;
		element?: HTMLButtonElement;
	}

	let { channel, active = false, occupants = [], onclick, element = $bindable() }: Props = $props();

	const occupied = $derived(occupants.length > 0);

	let shown = $state<Member[]>([]);
	$effect(() => {
		if (occupants.length > 0) shown = occupants;
	});
</script>

<div>
	<button
		bind:this={element}
		type="button"
		aria-pressed={active}
		{onclick}
		class="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-300 ease-soft {active
			? 'text-ink'
			: 'text-ink-secondary hover:bg-white/[0.04] hover:text-ink'}"
	>
		<Icon name={channel.kind} class={active ? 'text-ink' : 'text-muted'} />
		<span class="min-w-0 flex-1 truncate">{channel.name}</span>
		{#if occupied}
			<span class="shrink-0 text-[12px] text-muted tabular-nums">{occupants.length}</span>
		{/if}
	</button>

	<div class="collapsible relative z-10 {occupied ? 'is-open' : ''}" inert={!occupied}>
		<div>
			<div class="flex flex-col gap-0.5 pt-0.5 pb-1 pr-2.5 pl-[38px]">
				{#each shown as occupant (occupant.id)}
					<div class="flex h-7 items-center gap-2">
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-ink"
						>
							{initials(occupant.name)}
						</span>
						<span class="min-w-0 truncate text-[12px] text-ink-secondary">@{occupant.username}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
