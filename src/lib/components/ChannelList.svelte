<script lang="ts">
	import { untrack } from 'svelte';
	import type { Channel } from '$lib/channels/channels';
	import ChannelItem from './ChannelItem.svelte';

	interface Props {
		channels: Channel[];
		selectedChannelId: string | null;
		onselect: (channelId: string) => void;
	}

	let { channels, selectedChannelId, onselect }: Props = $props();

	let itemElements = $state<Record<string, HTMLButtonElement>>({});

	let highlightY = $state(0);
	let highlightVisible = $state(false);
	let slide = $state(false);

	$effect(() => {
		const item = selectedChannelId ? itemElements[selectedChannelId] : undefined;

		if (!item) {
			highlightVisible = false;
			return;
		}

		slide = untrack(() => highlightVisible);
		highlightY = item.offsetTop;
		highlightVisible = true;
	});

	const transition = $derived(
		(slide ? 'translate 320ms cubic-bezier(0.4, 0, 0.2, 1), ' : '') +
			'scale 220ms var(--ease-soft), opacity 220ms ease-out'
	);
</script>

<div class="relative flex flex-col gap-0.5">
	{#each channels as channel (channel.id)}
		<ChannelItem
			{channel}
			active={channel.id === selectedChannelId}
			onclick={() => onselect(channel.id)}
			bind:element={itemElements[channel.id]}
		/>
	{/each}

	<span
		aria-hidden="true"
		class="absolute inset-x-0 top-0 h-9 rounded-lg bg-white/[0.06] {highlightVisible
			? 'opacity-100'
			: 'opacity-0'}"
		style="translate: 0 {highlightY}px; scale: {highlightVisible ? 1 : 0.96}; transition: {transition};"
	></span>
</div>
