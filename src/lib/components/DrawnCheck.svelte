<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { draw } from 'svelte/transition';

	interface Props {
		size: number;
		strokeWidth?: number;
		duration?: number;
		delay?: number;
		class?: string;
	}

	let { size, strokeWidth = 2, duration = 280, delay = 0, class: className = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={className}
>
	<path
		d="M3.25 8.5 6.5 11.75 12.75 4.75"
		in:draw|global={{ duration: prefersReducedMotion.current ? 0 : duration, delay }}
	/>
</svg>
