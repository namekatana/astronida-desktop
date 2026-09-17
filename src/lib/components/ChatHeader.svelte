<script lang="ts">
	import type { Channel } from '$lib/channels/channels';
	import Icon from './Icon.svelte';

	interface Props {
		channel: Channel;
	}

	let { channel }: Props = $props();
</script>

<header class="panel flex shrink-0 items-center gap-2.5 px-5 pt-4 pb-3 text-ink">
	<Icon name={channel.kind} class="text-muted" />
	<h1 class="min-w-0 truncate text-[15px] font-semibold">{channel.name}</h1>
</header>
