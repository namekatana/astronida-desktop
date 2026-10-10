<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { draw } from 'svelte/transition';
	import { constellationNamed, type ConstellationName } from '$lib/ui/constellations';

	interface Props {
		name: ConstellationName;
	}

	let { name }: Props = $props();

	const drawMs = 600;

	const figure = $derived(constellationNamed(name));
	const drawDuration = $derived(prefersReducedMotion.current ? 0 : drawMs);
</script>

<svg width="200" height="134" viewBox="0 0 240 160" fill="none" aria-hidden="true" class="overflow-visible">
	{#each figure.links as [from, to] (`${from}-${to}`)}
		<line
			in:draw|global={{ duration: drawDuration, easing: cubicOut }}
			x1={figure.stars[from].x}
			y1={figure.stars[from].y}
			x2={figure.stars[to].x}
			y2={figure.stars[to].y}
			stroke="var(--color-line)"
			stroke-width="1"
		/>
	{/each}
	{#each figure.stars as star, index (index)}
		<circle
			class="twinkle"
			cx={star.x}
			cy={star.y}
			r={2 * star.scale}
			fill="var(--color-ink)"
			style="animation-delay: {-index * 0.7}s"
		/>
	{/each}
</svg>

<style>
	.twinkle {
		animation: twinkle 4.2s ease-in-out infinite;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 0.95;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.twinkle {
			animation-play-state: paused;
		}
	}
</style>
