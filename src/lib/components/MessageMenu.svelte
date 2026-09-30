<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import type { IconName } from '$lib/ui/icons';
	import { pop } from '$lib/ui/pop';
	import type { MessageMenuMode } from './message-menu';
	import Icon from './Icon.svelte';

	interface Props {
		x: number;
		y: number;
		mode: MessageMenuMode;
		onclose: () => void;
		oncancel?: () => void;
		onreply?: () => void;
		onforward?: () => void;
	}

	let { x, y, mode, onclose, oncancel, onreply, onforward }: Props = $props();

	const width = 200;
	const margin = 8;

	let root = $state<HTMLDivElement | null>(null);
	let height = $state(0);

	const left = $derived(Math.max(margin, Math.min(x, window.innerWidth - width - margin)));
	const top = $derived(Math.max(margin, Math.min(y, window.innerHeight - height - margin)));

	function cancelSending() {
		oncancel?.();
		onclose();
	}

	function reply() {
		onreply?.();
		onclose();
	}

	function forward() {
		onforward?.();
		onclose();
	}

	$effect(() => {
		if (!root) return;
		height = root.offsetHeight;
		return dismissOn(root, onclose);
	});
</script>

{#snippet item(icon: IconName, label: string, onclick: () => void, destructive = false)}
	<button
		type="button"
		role="menuitem"
		{onclick}
		class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-ink-secondary transition-colors duration-150 hover:bg-white/[0.06] {destructive
			? 'hover:text-danger'
			: 'hover:text-ink'}"
	>
		<Icon name={icon} size={15} class="text-muted" />
		<span class="min-w-0 flex-1 truncate">{label}</span>
	</button>
{/snippet}

<div
	bind:this={root}
	role="menu"
	aria-label={mode === 'pending' ? 'Неотправленное сообщение' : 'Сообщение'}
	in:pop={{ y: -4, duration: 180 }}
	out:fade={{ duration: 100 }}
	style="left: {left}px; top: {top}px; width: {width}px"
	class="panel panel-floating fixed z-50 origin-top-left p-1.5"
>
	{#if mode === 'pending'}
		{@render item('close', 'Отменить отправку', cancelSending, true)}
	{:else if mode === 'own'}
		<div class="flex flex-col gap-0.5">
			{@render item('reply', 'Ответить', reply)}
			{@render item('forward', 'Переслать', forward)}
		</div>
	{:else}
		<div class="flex flex-col gap-0.5">
			{@render item('reply', 'Ответить', reply)}
			{@render item('forward', 'Переслать', forward)}
			{@render item('pin', 'Закрепить сообщение', onclose)}
			{@render item('copy', 'Скопировать', onclose)}
		</div>
		<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
		<div class="flex flex-col gap-0.5">
			{@render item('trash', 'Удалить сообщение', onclose, true)}
			{@render item('flag', 'Пожаловаться', onclose, true)}
		</div>
	{/if}
</div>
