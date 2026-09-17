<script lang="ts">
	import type { Channel } from '$lib/channels/channels';
	import Icon from './Icon.svelte';

	interface Props {
		channel: Channel;
		active?: boolean;
		onclick?: () => void;
		element?: HTMLButtonElement;
	}

	let { channel, active = false, onclick, element = $bindable() }: Props = $props();
</script>

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
	<span class="min-w-0 truncate">{channel.name}</span>
</button>
