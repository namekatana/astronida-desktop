<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import type { IconName } from '$lib/ui/icons';
	import { pop } from '$lib/ui/pop';
	import type { MessageMenuMode } from './message-menu';
	import MenuItem from './MenuItem.svelte';

	interface Props {
		x: number;
		y: number;
		mode: MessageMenuMode;
		onclose: () => void;
		oncancel?: () => void;
		onreply?: () => void;
		onedit?: () => void;
		onforward?: () => void;
		pinned?: boolean;
		onpin?: () => void;
		oncopy?: () => void;
		ondelete?: () => void;
		photoCount?: number;
		onsavephoto?: () => void;
		onsaveallphotos?: () => void;
	}

	let {
		x,
		y,
		mode,
		onclose,
		oncancel,
		onreply,
		onedit,
		onforward,
		pinned = false,
		onpin,
		oncopy,
		ondelete,
		photoCount = 0,
		onsavephoto,
		onsaveallphotos
	}: Props = $props();

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

	function edit() {
		onedit?.();
		onclose();
	}

	function forward() {
		onforward?.();
		onclose();
	}

	function pin() {
		onpin?.();
		onclose();
	}

	function copy() {
		oncopy?.();
		onclose();
	}

	function savePhoto() {
		onsavephoto?.();
		onclose();
	}

	function saveAllPhotos() {
		onsaveallphotos?.();
		onclose();
	}

	function remove() {
		ondelete?.();
		onclose();
	}

	$effect(() => {
		if (!root) return;
		height = root.offsetHeight;
		return dismissOn(root, onclose);
	});
</script>

{#snippet pinItem()}
	{#if onpin}
		{@render item(
			pinned ? 'pin-off' : 'pin',
			pinned ? 'Открепить сообщение' : 'Закрепить сообщение',
			pin
		)}
	{/if}
{/snippet}

{#snippet commonItems()}
	{@render item('reply', 'Ответить', reply)}
	{#if onedit}
		{@render item('pencil', 'Изменить', edit)}
	{/if}
	{#if onforward}
		{@render item('forward', 'Переслать', forward)}
	{/if}
	{@render pinItem()}
	{#if oncopy}
		{@render item('copy', 'Скопировать', copy)}
	{/if}
{/snippet}

{#snippet photoItems()}
	{@const canSaveAll = onsaveallphotos && photoCount > 1}
	{#if onsavephoto || canSaveAll}
		<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
		<div class="flex flex-col gap-0.5">
			{#if onsavephoto}
				{@render item('download', 'Скачать', savePhoto)}
			{/if}
			{#if canSaveAll}
				{@render item('download', `Скачать все (${photoCount})`, saveAllPhotos)}
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet item(icon: IconName, label: string, onclick: () => void, destructive = false)}
	<MenuItem {icon} {label} {onclick} {destructive} />
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
			{@render commonItems()}
		</div>
		{@render photoItems()}
		{#if ondelete}
			<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
			{@render item('trash', 'Удалить сообщение', remove, true)}
		{/if}
	{:else}
		<div class="flex flex-col gap-0.5">
			{@render commonItems()}
		</div>
		{@render photoItems()}
		<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
		<div class="flex flex-col gap-0.5">
			{#if ondelete}
				{@render item('trash', 'Удалить сообщение', remove, true)}
			{/if}
			{@render item('flag', 'Пожаловаться', onclose, true)}
		</div>
	{/if}
</div>
