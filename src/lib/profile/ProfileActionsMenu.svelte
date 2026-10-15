<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import { portal } from '$lib/ui/portal';
	import MenuItem from '$lib/ui/MenuItem.svelte';

	interface Props {
		anchor: HTMLElement;
		friendAction: 'add' | 'accept' | 'sent' | null;
		onmessage?: () => void;
		onfriendaction?: () => void;
		onshare?: () => void;
		onunfriend?: () => void;
		onclose: () => void;
	}

	let {
		anchor,
		friendAction,
		onmessage,
		onfriendaction,
		onshare,
		onunfriend,
		onclose
	}: Props = $props();

	const width = 224;
	const margin = 8;
	const gap = 6;

	let root = $state<HTMLDivElement | null>(null);
	let height = $state(0);

	const anchorRect = $derived(anchor.getBoundingClientRect());
	const left = $derived(
		Math.max(
			margin,
			Math.min(
				anchorRect.left + anchorRect.width / 2 - width / 2,
				window.innerWidth - width - margin
			)
		)
	);
	const top = $derived(
		anchorRect.bottom + gap + height > window.innerHeight - margin
			? Math.max(margin, anchorRect.top - gap - height)
			: anchorRect.bottom + gap
	);

	function choose(action: () => void) {
		action();
		onclose();
	}

	$effect(() => {
		if (!root) return;
		height = root.offsetHeight;
		return dismissOn(root, (target) => {
			if (target && anchor.contains(target)) return;
			onclose();
		});
	});
</script>

<div
	bind:this={root}
	use:portal
	role="menu"
	aria-label="Действия с профилем"
	in:pop={{ y: -4, duration: 180 }}
	out:fade={{ duration: 100 }}
	style="left: {left}px; top: {top}px; width: {width}px"
	class="panel panel-floating fixed z-50 origin-top p-1.5"
>
	<div class="flex flex-col gap-0.5">
		{#if onmessage}
			{@const message = onmessage}
			<MenuItem icon="text" label="Написать" onclick={() => choose(message)} />
		{/if}
		{#if friendAction === 'sent'}
			<MenuItem icon="check" label="Запрос отправлен" onclick={() => {}} disabled />
		{:else if friendAction && onfriendaction}
			{@const befriend = onfriendaction}
			<MenuItem
				icon={friendAction === 'accept' ? 'user-check' : 'user-plus'}
				label={friendAction === 'accept' ? 'Принять запрос' : 'Добавить в друзья'}
				onclick={() => choose(befriend)}
			/>
		{/if}
		{#if onshare}
			{@const share = onshare}
			<MenuItem icon="share" label="Поделиться профилем" onclick={() => choose(share)} />
		{/if}
	</div>

	{#if onunfriend}
		{@const unfriend = onunfriend}
		<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
		<MenuItem
			icon="user-minus"
			label="Удалить из друзей"
			onclick={() => choose(unfriend)}
			destructive
		/>
	{/if}
</div>
