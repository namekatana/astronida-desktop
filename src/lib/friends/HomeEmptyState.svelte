<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { draw, fade } from 'svelte/transition';
	import { constellations } from '$lib/ui/constellations';
	import { windowFocus } from '$lib/ui/window-focus.svelte';

	const holdMs = 4500;
	const fadeMs = 200;
	const moveMs = 1200;
	const drawMs = 600;

	const dust = [
		{ x: 14, y: 30, delay: 0 },
		{ x: 40, y: 146, delay: -1.6 },
		{ x: 222, y: 150, delay: -2.8 },
		{ x: 18, y: 110, delay: -0.9 },
		{ x: 226, y: 14, delay: -3.4 },
		{ x: 230, y: 92, delay: -2.2 },
		{ x: 104, y: 8, delay: -1.1 }
	];

	let figureIndex = $state(0);
	let phase = $state<'shown' | 'hiding' | 'moving'>('shown');

	const figure = $derived(constellations[figureIndex]);

	$effect(() => {
		if (prefersReducedMotion.current || !windowFocus.active) {
			phase = 'shown';
			return;
		}

		let timer: ReturnType<typeof setTimeout>;
		const hold = () => (timer = setTimeout(hide, holdMs));
		const hide = () => {
			phase = 'hiding';
			timer = setTimeout(move, fadeMs);
		};
		const move = () => {
			figureIndex = (figureIndex + 1) % constellations.length;
			phase = 'moving';
			timer = setTimeout(show, moveMs);
		};
		const show = () => {
			phase = 'shown';
			hold();
		};

		untrack(() => (phase === 'shown' ? hold() : show()));
		return () => clearTimeout(timer);
	});
</script>

<div class="flex flex-col items-center gap-5 text-center">
	<svg
		width="240"
		height="160"
		viewBox="0 0 240 160"
		fill="none"
		aria-hidden="true"
		class="overflow-visible"
	>
		{#if phase === 'shown'}
			<g out:fade={{ duration: fadeMs }}>
				{#each figure.links as [from, to] (`${from}-${to}`)}
					<line
						in:draw|global={{ duration: drawMs, easing: cubicOut }}
						x1={figure.stars[from].x}
						y1={figure.stars[from].y}
						x2={figure.stars[to].x}
						y2={figure.stars[to].y}
						stroke="var(--color-line)"
						stroke-width="1"
					/>
				{/each}
			</g>
		{/if}
		{#each dust as star (`${star.x}:${star.y}`)}
			<circle
				class="twinkle"
				cx={star.x}
				cy={star.y}
				r="1"
				fill="var(--color-ink)"
				style="animation-delay: {star.delay}s"
			/>
		{/each}
		{#each figure.stars as star, index (index)}
			<g
				class="star-slot"
				style="transform: translate({star.x}px, {star.y}px) scale({star.scale}); opacity: {star.hidden
					? 0
					: 1}"
			>
				<circle
					class="twinkle twinkle-bright"
					r="2"
					fill="var(--color-ink)"
					style="animation-delay: {-index * 0.7}s"
				/>
			</g>
		{/each}
	</svg>

	<div class="flex flex-col gap-1">
		<span class="text-[15px] font-semibold text-ink">Здесь тихо</span>
		<span class="text-[13px] text-muted">Выберите друга слева или добавьте нового</span>
	</div>
</div>

<style>
	.star-slot {
		transition:
			transform 1.2s var(--ease-move),
			opacity 1.2s var(--ease-move);
	}

	.twinkle {
		--twinkle-low: 0.1;
		--twinkle-high: 0.55;
		animation: twinkle 4.2s ease-in-out infinite;
	}

	.twinkle-bright {
		--twinkle-low: 0.45;
		--twinkle-high: 0.95;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: var(--twinkle-low);
		}
		50% {
			opacity: var(--twinkle-high);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.twinkle {
			animation-play-state: paused;
		}
	}
</style>
