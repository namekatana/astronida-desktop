<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { startSpoilerSky, type SpoilerSky } from '$lib/media/spoiler-sky';
	import type { ScreenPoint } from '$lib/media/spoilers.svelte';
	import { thumbHashImage } from '$lib/media/thumbhash-image';
	import { windowFocus } from '$lib/ui/window-focus.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		thumbHash: string;
		showLabel?: boolean;
		revealed?: () => { origin: ScreenPoint | null } | null;
	}

	let { thumbHash, showLabel = true, revealed }: Props = $props();

	const compactWidth = 120;
	const compactHeight = 80;

	let root = $state<HTMLSpanElement>();
	let canvas = $state<HTMLCanvasElement>();
	let compact = $state(false);
	let sky = $state<SpoilerSky | null>(null);

	const background = $derived(thumbHashImage(thumbHash));

	$effect(() => {
		if (!root || !canvas) return;
		const started = startSpoilerSky(root, canvas, {
			reducedMotion: prefersReducedMotion.current,
			revealed: () => revealed?.() ?? null,
			onresize: (width, height) => (compact = width < compactWidth || height < compactHeight)
		});
		sky = started;
		return () => {
			started.stop();
			sky = null;
		};
	});

	$effect(() => {
		sky?.setActive(windowFocus.active);
	});
</script>

<span bind:this={root} class="absolute inset-0 block overflow-hidden bg-[#0e0e10]">
	{#if background}
		<img
			src={background}
			alt=""
			aria-hidden="true"
			draggable="false"
			class="absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-[0.55]"
		/>
	{/if}
	<canvas bind:this={canvas} aria-hidden="true" class="absolute inset-0 h-full w-full"></canvas>
	{#if showLabel}
		<span
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 flex items-center justify-center"
		>
			<span
				class="flex h-8 items-center justify-center gap-1.5 rounded-full bg-black/45 text-white duration-150 group-hover:bg-black/60 {compact
					? 'w-8'
					: 'px-3'}"
			>
				<Icon name="eye" size={14} />
				{#if !compact}
					<span class="text-[13px] font-semibold tracking-[-0.01em]">Показать</span>
				{/if}
			</span>
		</span>
	{/if}
</span>
