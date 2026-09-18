<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { ChannelKind } from '$lib/channels/channels';
	import { dismissOn } from '$lib/ui/dismiss';
	import Icon from './Icon.svelte';

	interface Props {
		oncreatecategory: () => void;
		oncreatechannel: (kind: ChannelKind) => void;
	}

	let { oncreatecategory, oncreatechannel }: Props = $props();

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
		class="flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 {open
			? 'bg-white/[0.06] text-ink'
			: 'text-muted hover:bg-white/[0.06] hover:text-ink'}"
	>
		<Icon name="dots" size={16} />
	</button>

	{#if open}
		<div
			role="menu"
			in:fly={{ y: -6, duration: 220, easing: (t) => 1 - Math.pow(1 - t, 3) }}
			out:fade={{ duration: 120 }}
			class="panel absolute top-full right-0 z-50 mt-2 w-52 origin-top-right p-1.5"
		>
			{#snippet item(label: string, icon: 'plus' | 'text' | 'voice', action: () => void)}
				<button
					type="button"
					role="menuitem"
					onclick={() => pick(action)}
					class="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] text-ink-secondary transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink"
				>
					<Icon name={icon} class="text-muted" />
					{label}
				</button>
			{/snippet}

			{@render item('Добавить категорию', 'plus', oncreatecategory)}
			{@render item('Текстовый канал', 'text', () => oncreatechannel('text'))}
			{@render item('Голосовой канал', 'voice', () => oncreatechannel('voice'))}
		</div>
	{/if}
</div>
