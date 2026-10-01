<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { materialize } from '$lib/ui/materialize';
	import { settle } from '$lib/ui/settle';
	import { toast } from '$lib/ui/toast.svelte';
	import DrawnCheck from './DrawnCheck.svelte';
	import Icon from './Icon.svelte';

	let lastShown = { text: '', failed: false, version: 0 };

	const shown = $derived.by(() => {
		if (toast.current) lastShown = toast.current;
		return lastShown;
	});
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
					{#if shown.failed}
						<Icon name="close" size={13} class="shrink-0 text-danger" />
					{:else}
						<DrawnCheck size={14} delay={100} class="shrink-0" />
					{/if}
					{shown.text}
				</span>
			{/key}
		</div>
	{/if}
</div>
