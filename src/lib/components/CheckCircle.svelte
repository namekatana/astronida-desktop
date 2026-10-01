<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { draw } from 'svelte/transition';

	interface Props {
		checked: boolean;
	}

	let { checked }: Props = $props();
</script>

<span
	aria-hidden="true"
	class="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 {checked
		? 'border-transparent'
		: 'border-white/20'}"
>
	<span
		class="absolute inset-0 rounded-full bg-ink transition-[scale,opacity] duration-180 ease-soft {checked
			? 'scale-100 opacity-100'
			: 'scale-60 opacity-0'}"
	></span>
	{#if checked}
		<svg
			width="11"
			height="11"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="relative text-bg"
		>
			<path
				d="M3.25 8.5 6.5 11.75 12.75 4.75"
				in:draw={{ duration: prefersReducedMotion.current ? 0 : 220 }}
			/>
		</svg>
	{/if}
</span>
