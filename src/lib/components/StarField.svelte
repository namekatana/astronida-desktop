<script lang="ts">

	interface Star {
		x: number;
		y: number;
		size: 1 | 2;
		twinkleDuration: number;
		twinkleDelay: number;
		peak: number;
		driftX: number;
		driftY: number;
		driftDuration: number;
		driftDelay: number;
	}

	const starCount = 70;
	const clearHalfWidth = 0.26;
	const horizonFade = 80;

	let width = $state(0);
	let height = $state(0);

	function horizon(w: number, h: number) {
		const diameter = 1.5 * w;
		return { cx: w / 2, cy: h - diameter + 0.62 * diameter + diameter / 2, r: diameter / 2 };
	}

	function generate(w: number, h: number): Star[] {
		if (w === 0 || h === 0) return [];
		let seed = 20260914;
		const random = () => {
			seed = (seed * 1664525 + 1013904223) % 4294967296;
			return seed / 4294967296;
		};
		const { cx, cy, r } = horizon(w, h);
		const list: Star[] = [];
		let attempts = 0;
		while (list.length < starCount && attempts < 20000) {
			attempts++;
			const px = random() * w;
			const py = random() * h;

			const aboveHorizon = Math.hypot(px - cx, py - cy) - r;
			if (aboveHorizon <= 0) continue;

			const fromColumn = Math.abs(px - cx) / (w / 2);
			if (fromColumn < clearHalfWidth) continue;
			const sideWeight = Math.pow((fromColumn - clearHalfWidth) / (1 - clearHalfWidth), 1.3);
			const horizonWeight = Math.min(1, aboveHorizon / horizonFade);
			const topWeight = 0.25 + 0.75 * (1 - py / h);
			if (random() > sideWeight * horizonWeight * topWeight) continue;

			const cornerness = Math.max(Math.abs(px - w / 2) / (w / 2), Math.abs(py - h / 2) / (h / 2));
			list.push({
				x: (px / w) * 100,
				y: (py / h) * 100,
				size: cornerness > 0.6 && random() < 0.3 ? 2 : 1,
				twinkleDuration: 8 + random() * 6,
				twinkleDelay: -random() * 14,
				peak: 0.25 + 0.55 * cornerness,
				driftX: (4 + random() * 6) * (random() < 0.5 ? -1 : 1),
				driftY: 4 + random() * 6,
				driftDuration: 25 + random() * 20,
				driftDelay: -random() * 45
			});
		}
		return list;
	}

	const stars = $derived(generate(width, height));
	const far = $derived(stars.filter((star) => star.size === 1));
	const near = $derived(stars.filter((star) => star.size === 2));

	let pointerX = $state(0);
	let pointerY = $state(0);

	function handlePointerMove(event: PointerEvent) {
		pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
		pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
	}

	function resetPointer() {
		pointerX = 0;
		pointerY = 0;
	}

	const layerShift = (depth: number) => `transform: translate(${-pointerX * depth}px, ${-pointerY * depth}px)`;
</script>

<svelte:window onpointermove={handlePointerMove} onblur={resetPointer} />
<svelte:document onpointerleave={resetPointer} />

<div
	bind:clientWidth={width}
	bind:clientHeight={height}
	class="anim-fade absolute inset-0 [animation-delay:0.6s] [animation-duration:1.6s]"
>
	{#snippet layer(list: Star[], depth: number)}
		<div class="star-layer absolute inset-0" style={layerShift(depth)}>
			{#each list as star, index (index)}
				<span
					class="star absolute rounded-full bg-white"
					style="left: {star.x}%; top: {star.y}%; width: {star.size}px; height: {star.size}px; --twinkle-duration: {star.twinkleDuration}s; --twinkle-delay: {star.twinkleDelay}s; --twinkle-peak: {star.peak}; --drift-x: {star.driftX}px; --drift-y: {star.driftY}px; --drift-duration: {star.driftDuration}s; --drift-delay: {star.driftDelay}s;"
				></span>
			{/each}
		</div>
	{/snippet}

	{@render layer(far, 6)}
	{@render layer(near, 14)}
</div>
