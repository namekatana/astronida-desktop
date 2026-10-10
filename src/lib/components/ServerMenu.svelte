<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ChannelKind } from '$lib/channels/channels';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import Icon from './Icon.svelte';
	import MenuItem from './MenuItem.svelte';

	interface Props {
		oncreatecategory: () => void;
		oncreatechannel: (kind: ChannelKind) => void;
		onopensettings?: () => void;
	}

	let { oncreatecategory, oncreatechannel, onopensettings }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (!open || !root) return;
		return dismissOn(root, () => (open = false));
	});

	function pick(action: () => void) {
		open = false;
		action();
	}
</script>

<div bind:this={root} class="relative">
	<button
		type="button"
		aria-label="Действия с сервером"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="pressable flex h-8 w-8 items-center justify-center rounded-full duration-200 {open
			? 'bg-white/[0.06] text-ink'
			: 'text-muted hover:bg-white/[0.06] hover:text-ink'}"
	>
		<Icon name="dots" size={16} />
	</button>

	{#if open}
		<div
			role="menu"
			aria-label="Действия с сервером"
			in:pop={{ y: -4, duration: 180 }}
			out:fade={{ duration: 100 }}
			class="panel panel-floating absolute top-full right-0 z-50 mt-2 w-[200px] origin-top-right p-1.5"
		>
			<MenuItem icon="plus" label="Новая категория" onclick={() => pick(oncreatecategory)} />
			<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
			<div class="flex flex-col gap-0.5">
				<MenuItem
					icon="text"
					label="Текстовый канал"
					onclick={() => pick(() => oncreatechannel('text'))}
				/>
				<MenuItem
					icon="voice"
					label="Голосовой канал"
					onclick={() => pick(() => oncreatechannel('voice'))}
				/>
			</div>
			{#if onopensettings}
				{@const openSettings = onopensettings}
				<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
				<MenuItem icon="gear" label="Настройки сервера" onclick={() => pick(openSettings)} />
			{/if}
		</div>
	{/if}
</div>
