<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { draw } from 'svelte/transition';
	import { materialize } from '$lib/ui/materialize';
	import { toast } from '$lib/ui/toast.svelte';

	let lastShown = { text: '', version: 0 };

	const shown = $derived.by(() => {
		if (toast.current) lastShown = toast.current;
		return lastShown;
	});

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<div
	aria-live="polite"
	class="pointer-events-none absolute inset-x-0 bottom-9 z-10 flex justify-center px-4"
>
	{#if toast.current}
		<div
			in:materialize={{ y: 8, scale: 0.96, blur: 4, duration: 320 }}
			out:materialize={{ y: 4, scale: 0.98, duration: 180, easing: cubicOut }}
			class="grid h-8 items-center rounded-full bg-[#2c2c2e] px-3.5 will-change-transform"
		>
			{#key shown.version}
				<span
					in:settle
					out:settle={{ duration: 100 }}
					class="col-start-1 row-start-1 flex items-center justify-center gap-1.5 text-[13px] font-medium tracking-[-0.01em] whitespace-nowrap text-ink"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						class="shrink-0"
					>
						<path
							d="M3.25 8.5 6.5 11.75 12.75 4.75"
							in:draw|global={{ duration: prefersReducedMotion.current ? 0 : 280, delay: 100 }}
						/>
					</svg>
					{shown.text}
				</span>
			{/key}
		</div>
	{/if}
</div>
