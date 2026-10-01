<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { on } from 'svelte/events';
	import { pop } from '$lib/ui/pop';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		label: string;
		children: Snippet;
		locked?: boolean;
		wide?: boolean;
		pinTop?: boolean;
		flush?: boolean;
		onclose: () => void;
		onclosed?: () => void;
	}

	let {
		label,
		children,
		locked = false,
		wide = false,
		pinTop = false,
		flush = false,
		onclose,
		onclosed
	}: Props = $props();

	const opticalCenter = 0.4;
	const minTop = 24;

	let overlay = $state<HTMLDivElement>();
	let dialog = $state<HTMLDivElement | null>(null);
	let pinnedTop = $state<number | null>(null);

	$effect(() => {
		if (!pinTop || !overlay || !dialog || pinnedTop !== null) return;
		const free = overlay.clientHeight - dialog.offsetHeight;
		pinnedTop = Math.max(minTop, Math.round(free * opticalCenter));
	});

	$effect(() => {
		dialog?.querySelector('input')?.focus();
	});

	$effect(() => {
		const offKey = on(document, 'keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			if (!locked) onclose();
		});
		return offKey;
	});
</script>

<div
	class="absolute inset-0 z-40 flex flex-col bg-bg/70"
	transition:fade={{ duration: 160 }}
	onoutroend={onclosed}
>
	<SmoothScroll bind:viewport={overlay} class="min-h-0 flex-1" contentClass="flex min-h-full flex-col">
		<div
			class="flex flex-1 justify-center px-8 py-6 {pinnedTop === null
				? 'items-center'
				: 'items-start'}"
			style:padding-top={pinnedTop === null ? null : `${pinnedTop}px`}
		>
			<div
				bind:this={dialog}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				in:pop={{ y: 8, duration: 240 }}
				out:fade={{ duration: 120 }}
				class="panel panel-floating w-full {wide ? 'max-w-[400px]' : 'max-w-[340px]'} {flush
					? ''
					: 'px-7 pt-7 pb-6'} [--pill-surface:var(--color-surface)]"
			>
				{@render children()}
			</div>
		</div>
	</SmoothScroll>
</div>
