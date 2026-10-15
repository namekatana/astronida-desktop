<script lang="ts">
	interface Props {
		radius: number;
		strokeWidth?: number;
		dash?: number;
		class?: string;
	}

	let { radius, strokeWidth = 1, dash = 4, class: className = '' }: Props = $props();

	let width = $state(0);
	let height = $state(0);

	const inset = $derived(strokeWidth / 2);
	const innerWidth = $derived(Math.max(0, width - strokeWidth));
	const innerHeight = $derived(Math.max(0, height - strokeWidth));
	const cornerRadius = $derived(
		Math.max(0, Math.min(radius - inset, innerWidth / 2, innerHeight / 2))
	);
	const perimeter = $derived(
		2 * (innerWidth + innerHeight) - (8 - 2 * Math.PI) * cornerRadius
	);
	const dashCount = $derived(Math.max(2, Math.round(perimeter / (dash * 2))));
</script>

<span
	aria-hidden="true"
	bind:clientWidth={width}
	bind:clientHeight={height}
	class="pointer-events-none absolute inset-0 {className}"
>
	{#if width > 0 && height > 0}
		<svg {width} {height} class="absolute inset-0 overflow-visible">
			<rect
				x={inset}
				y={inset}
				width={innerWidth}
				height={innerHeight}
				rx={cornerRadius}
				fill="none"
				stroke="currentColor"
				stroke-width={strokeWidth}
				pathLength={dashCount * 2}
				stroke-dasharray="1 1"
			/>
		</svg>
	{/if}
</span>
