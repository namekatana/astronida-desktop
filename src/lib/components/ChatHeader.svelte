<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Channel } from '$lib/channels/channels';
	import Icon from './Icon.svelte';

	interface Props {
		channel: Channel;
		trailing?: Snippet;
	}

	let { channel, trailing }: Props = $props();
</script>

<header class="panel flex shrink-0 items-center gap-2.5 px-5 py-3.5 text-ink">
	<Icon name={channel.kind} class="text-muted" />
	<h1 class="min-w-0 truncate text-[15px] leading-6 font-semibold">{channel.name}</h1>
	{@render trailing?.()}
</header>
