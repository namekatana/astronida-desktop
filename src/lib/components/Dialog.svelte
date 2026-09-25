<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { on } from 'svelte/events';
	import { pop } from '$lib/ui/pop';

	interface Props {
		label: string;
		children: Snippet;
		locked?: boolean;
		wide?: boolean;
		onclose: () => void;
	}

	let { label, children, locked = false, wide = false, onclose }: Props = $props();

	let dialog = $state<HTMLDivElement | null>(null);

	$effect(() => {
		dialog?.querySelector('input')?.focus();
	});

	$effect(() => {
		const offKey = on(document, 'keydown', (event) => {
			if (event.key === 'Escape' && !locked) onclose();
		});
		return offKey;
	});
</script>

<div
	class="scrollbar-none absolute inset-0 z-40 overflow-y-auto bg-bg/70"
	transition:fade={{ duration: 160 }}
>
	<div
		role="presentation"
		class="flex min-h-full items-center justify-center px-8 py-6"
		onpointerdown={(event) => {
			if (event.target === event.currentTarget && !locked) onclose();
		}}
	>
		<div
			bind:this={dialog}
			role="dialog"
			aria-modal="true"
			aria-label={label}
			in:pop={{ y: 8, duration: 240 }}
			out:fade={{ duration: 120 }}
			class="panel w-full {wide ? 'max-w-[400px]' : 'max-w-[340px]'} px-7 pt-7 pb-6 [--pill-surface:var(--color-surface)]"
		>
			{@render children()}
		</div>
	</div>
</div>
