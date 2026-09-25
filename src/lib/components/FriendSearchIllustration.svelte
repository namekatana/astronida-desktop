<script lang="ts">
	const orbitSeconds = 14;

	const satellites = [
		{ phase: 0, kind: 'person' },
		{ phase: 1 / 3, kind: 'person' },
		{ phase: 2 / 3, kind: 'unknown' }
	] as const;

	const stars = [
		{ x: 10, y: 18, delay: 0 },
		{ x: 150, y: 12, delay: -1.4 },
		{ x: 158, y: 70, delay: -2.6 },
		{ x: 22, y: 84, delay: -0.8 },
		{ x: 132, y: 92, delay: -3.3 },
		{ x: 44, y: 8, delay: -2 }
	];
</script>

{#snippet person(size: number)}
	<svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path
			d="M8 8a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 8 8Z"
			stroke="currentColor"
			stroke-width="1.5"
		/>
		<path
			d="M3 13.5c.45-2.4 2.5-3.75 5-3.75s4.55 1.35 5 3.75"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	</svg>
{/snippet}

<div class="illustration" aria-hidden="true">
	{#each stars as star (`${star.x}:${star.y}`)}
		<span class="star" style="left: {star.x}px; top: {star.y}px; animation-delay: {star.delay}s"
		></span>
	{/each}

	<div class="scene">
		<span class="ring"></span>

		<span class="center">
			{@render person(18)}
		</span>

		{#each satellites as satellite (satellite.phase)}
			<span
				class="orbiter"
				style="animation-delay: {-satellite.phase * orbitSeconds}s; --orbit-duration: {orbitSeconds}s"
			>
				<span
					class="satellite {satellite.kind === 'unknown' ? 'satellite-unknown' : ''}"
					style="animation-delay: {-satellite.phase * orbitSeconds}s"
				>
					{#if satellite.kind === 'unknown'}
						<svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path
								d="M8 3v10M3 8h10"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
					{:else}
						{@render person(11)}
					{/if}
				</span>
			</span>
		{/each}
	</div>
</div>

<style>
	.illustration {
		--orbit-radius: 58px;
		--orbit-tilt: 18deg;
		position: relative;
		width: 168px;
		height: 104px;
		perspective: 520px;
	}

	.scene {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-style: preserve-3d;
		transform: rotateX(calc(var(--orbit-tilt) * -1));
	}

	.ring {
		position: absolute;
		left: calc(var(--orbit-radius) * -1);
		top: calc(var(--orbit-radius) * -1);
		width: calc(var(--orbit-radius) * 2);
		height: calc(var(--orbit-radius) * 2);
		border: 1px dashed var(--color-line);
		border-radius: 9999px;
		transform: rotateX(90deg);
	}

	.center {
		position: absolute;
		left: -18px;
		top: -18px;
		display: flex;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background-color: var(--color-surface-raised);
		color: var(--color-ink);
		outline: 1px solid var(--color-line);
		outline-offset: 3px;
		transform: rotateX(var(--orbit-tilt));
	}

	.orbiter {
		position: absolute;
		left: -10px;
		top: -10px;
		width: 20px;
		height: 20px;
		transform-style: preserve-3d;
		animation: orbit var(--orbit-duration) linear infinite;
	}

	.satellite {
		display: flex;
		width: 20px;
		height: 20px;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background-color: var(--color-surface-raised);
		color: var(--color-ink-secondary);
		animation: depth var(--orbit-duration) ease-in-out infinite;
	}

	.satellite-unknown {
		background-color: var(--color-surface);
		border: 1px dashed var(--color-line-strong);
		color: var(--color-muted);
	}

	.star {
		position: absolute;
		width: 2px;
		height: 2px;
		border-radius: 9999px;
		background-color: var(--color-ink);
		animation: star-twinkle 4.2s ease-in-out infinite;
	}

	@keyframes orbit {
		from {
			transform: rotateY(0deg) translateZ(var(--orbit-radius)) rotateY(0deg)
				rotateX(var(--orbit-tilt));
		}
		to {
			transform: rotateY(360deg) translateZ(var(--orbit-radius)) rotateY(-360deg)
				rotateX(var(--orbit-tilt));
		}
	}

	@keyframes depth {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@keyframes star-twinkle {
		0%,
		100% {
			opacity: 0.1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.orbiter,
		.satellite,
		.star {
			animation-play-state: paused;
		}
	}
</style>
