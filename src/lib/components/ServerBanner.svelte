<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { startSpoilerSky, type SpoilerSky } from '$lib/media/spoiler-sky';
	import { windowFocus } from '$lib/ui/window-focus.svelte';
	import Icon from './Icon.svelte';

	let skyHost = $state<HTMLDivElement | null>(null);
	let skyCanvas = $state<HTMLCanvasElement | null>(null);
	let sky = $state<SpoilerSky | null>(null);

	$effect(() => {
		const host = skyHost;
		const canvas = skyCanvas;
		if (!host || !canvas) return;
		const started = startSpoilerSky(host, canvas, { reducedMotion: prefersReducedMotion.current });
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

<div
	title="Баннер сервера — скоро"
	class="group relative aspect-[4/1] w-full overflow-hidden rounded-[12px] [corner-shape:squircle]"
>
	<div
		bind:this={skyHost}
		aria-hidden="true"
		class="absolute inset-0 bg-[radial-gradient(120%_140%_at_50%_120%,rgba(255,255,255,0.07),transparent_60%),linear-gradient(180deg,#121216,#0c0c0f)]"
	>
		<canvas bind:this={skyCanvas} class="absolute inset-0 h-full w-full"></canvas>
	</div>
	<div
		aria-hidden="true"
		class="absolute inset-0 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink opacity-0 bg-black/45 transition-opacity duration-150 group-hover:opacity-100"
	>
		<Icon name="lock" size={12} />
		Скоро
	</div>
</div>
