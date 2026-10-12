<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { startSpoilerSky, type SpoilerSky } from '$lib/media/spoiler-sky';
	import { windowFocus } from '$lib/ui/window-focus.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const areaPerStar = 1800;

	let host = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let sky = $state<SpoilerSky | null>(null);

	$effect(() => {
		if (!host || !canvas) return;
		const started = startSpoilerSky(host, canvas, {
			reducedMotion: prefersReducedMotion.current,
			areaPerStar
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

<div bind:this={host} aria-hidden="true" class="night-sky relative overflow-hidden {className}">
	<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>
</div>
