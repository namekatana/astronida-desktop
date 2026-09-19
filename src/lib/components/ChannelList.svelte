<script lang="ts">
	import { untrack } from 'svelte';
	import type { Channel } from '$lib/channels/channels';
	import type { VoiceOccupant } from '$lib/voice/occupant';
	import ChannelItem from './ChannelItem.svelte';

	interface Props {
		channels: Channel[];
		selectedChannelId: string | null;
		voiceOccupants?: Record<string, VoiceOccupant[]>;
		onselect: (channelId: string) => void;
		onprefetch?: (channelId: string) => void;
	}

	let { channels, selectedChannelId, voiceOccupants = {}, onselect, onprefetch }: Props = $props();

	let itemElements = $state<Record<string, HTMLButtonElement>>({});

	let highlightY = $state(0);
	let highlightVisible = $state(false);
	let move = $state<'none' | 'slide' | 'follow'>('none');

	const layoutSettleMs = 500;
	let followUntil = 0;
	let followFrame: number | null = null;

	function selectedItem() {
		return selectedChannelId ? itemElements[selectedChannelId] : undefined;
	}

	function followLayout() {
		followFrame = null;
		const item = untrack(selectedItem);
		if (item) {
			highlightY = item.offsetTop;
			move = 'follow';
		}
		if (performance.now() < followUntil) followFrame = requestAnimationFrame(followLayout);
	}

	function handleLayoutTransition(event: TransitionEvent) {
		if (event.propertyName !== 'grid-template-rows') return;
		followUntil = performance.now() + layoutSettleMs;
		if (followFrame === null) followFrame = requestAnimationFrame(followLayout);
	}

	$effect(() => {
		const item = selectedItem();

		if (!item) {
			highlightVisible = false;
			return;
		}

		move = untrack(() => (highlightVisible ? 'slide' : 'none'));
		highlightY = item.offsetTop;
		highlightVisible = true;
	});

	$effect(() => {
		return () => {
			if (followFrame !== null) cancelAnimationFrame(followFrame);
		};
	});

	const transition = $derived(
		(move === 'slide'
			? 'translate 320ms cubic-bezier(0.4, 0, 0.2, 1), '
			: move === 'follow'
				? 'translate 120ms ease-out, '
				: '') + 'scale 220ms var(--ease-soft), opacity 220ms ease-out'
	);
</script>

<div class="relative flex flex-col gap-0.5" ontransitionrun={handleLayoutTransition}>
	{#each channels as channel (channel.id)}
		<ChannelItem
			{channel}
			active={channel.id === selectedChannelId}
			occupants={voiceOccupants[channel.id]}
			onclick={() => onselect(channel.id)}
			onprefetch={channel.kind === 'voice' ? () => onprefetch?.(channel.id) : undefined}
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
