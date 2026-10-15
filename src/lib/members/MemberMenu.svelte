<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ModerationTarget } from './moderation-target';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import { portal } from '$lib/ui/portal';
	import Avatar from '$lib/profile/Avatar.svelte';
	import MenuItem from '$lib/ui/MenuItem.svelte';
	import ModerationItems from './ModerationItems.svelte';

	interface Props {
		target: ModerationTarget;
		subtitle: string | null;
		serverName: string | null;
		x: number;
		y: number;
		canModerate: boolean;
		onclose: () => void;
		onprofile: () => void;
		onkick: () => void;
		onban: () => void;
		onunfriend?: () => void;
		onshare?: () => void;
	}

	let {
		target,
		subtitle,
		serverName,
		x,
		y,
		canModerate,
		onclose,
		onprofile,
		onkick,
		onban,
		onunfriend,
		onshare
	}: Props = $props();

	const width = 224;
	const margin = 8;

	let root = $state<HTMLDivElement | null>(null);
	let height = $state(0);

	const left = $derived(Math.max(margin, Math.min(x, window.innerWidth - width - margin)));
	const top = $derived(Math.max(margin, Math.min(y, window.innerHeight - height - margin)));

	function choose(action: () => void) {
		action();
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
	use:portal
	role="menu"
	aria-label="Участник @{target.username}"
	in:pop={{ y: -4, duration: 180 }}
	out:fade={{ duration: 100 }}
	style="left: {left}px; top: {top}px; width: {width}px"
	class="panel panel-floating fixed z-50 origin-top-left p-1.5"
>
	<div class="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
		<Avatar name={target.name} size={32} userId={target.id} avatarId={target.avatarId} />
		<div class="min-w-0">
			<div class="truncate text-[13px] leading-[18px] font-semibold text-ink">@{target.username}</div>
			{#if subtitle}
				<div class="truncate text-[11px] leading-4 text-muted">{subtitle}</div>
			{/if}
		</div>
	</div>
	<div class="mx-1.5 h-px bg-surface-line"></div>

	<div class="mt-1.5 flex flex-col gap-0.5">
		<MenuItem icon="user" label="Профиль" onclick={() => choose(onprofile)} />
		{#if onshare}
			{@const share = onshare}
			<MenuItem icon="share" label="Поделиться профилем" onclick={() => choose(share)} />
		{/if}
		{#if onunfriend}
			{@const unfriend = onunfriend}
			<MenuItem
				icon="user-minus"
				label="Удалить из друзей"
				onclick={() => choose(unfriend)}
				destructive
			/>
		{/if}
	</div>

	{#if canModerate && serverName !== null}
		<ModerationItems
			{serverName}
			onkick={() => choose(onkick)}
			onban={() => choose(onban)}
		/>
	{/if}
</div>
