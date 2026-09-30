<script lang="ts">
	import { fade } from 'svelte/transition';
	import Icon from './Icon.svelte';

	interface Props {
		count: number;
		visible: boolean;
		onshow: () => void;
	}

	let { count, visible, onshow }: Props = $props();
</script>

<span class="ml-auto -my-1 flex h-8 shrink-0 items-center">
	{#if visible}
		<button
			type="button"
			onclick={onshow}
			transition:fade={{ duration: 150 }}
			aria-label="Показать закреплённые"
			class="pressable flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[12px] font-semibold text-ink-secondary tabular-nums hover:bg-white/[0.1] hover:text-ink"
		>
			<Icon name="pin" size={14} />
			{count}
		</button>
	{/if}
</span>
