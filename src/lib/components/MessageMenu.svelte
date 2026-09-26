<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import Icon from './Icon.svelte';

	interface Props {
		x: number;
		y: number;
		onclose: () => void;
		oncancel: () => void;
	}

	let { x, y, onclose, oncancel }: Props = $props();

	const width = 200;
	const margin = 8;

	let root = $state<HTMLDivElement | null>(null);
	let height = $state(0);

	const left = $derived(Math.max(margin, Math.min(x, window.innerWidth - width - margin)));
	const top = $derived(Math.max(margin, Math.min(y, window.innerHeight - height - margin)));

	function cancelSending() {
		oncancel();
		onclose();
	}

	$effect(() => {
		if (!root) return;
		height = root.offsetHeight;
		return dismissOn(root, onclose);
	});
</script>

<div
	bind:this={root}
	role="menu"
	aria-label="Неотправленное сообщение"
	in:pop={{ y: -4, duration: 180 }}
	out:fade={{ duration: 100 }}
	style="left: {left}px; top: {top}px; width: {width}px"
	class="panel fixed z-50 origin-top-left p-1.5"
>
	<button
		type="button"
		role="menuitem"
		onclick={cancelSending}
		class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-ink-secondary transition-colors duration-150 hover:bg-white/[0.06] hover:text-danger"
	>
		<Icon name="close" size={15} class="text-muted" />
		<span class="min-w-0 flex-1 truncate">Отменить отправку</span>
	</button>
</div>
