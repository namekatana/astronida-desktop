<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import { initials } from '$lib/ui/initials';

	interface Props {
		name: string;
		active?: boolean;
		unread?: boolean;
		onclick?: () => void;
		element?: HTMLButtonElement;
	}

	let { name, active = false, unread = false, onclick, element = $bindable() }: Props = $props();

	const avatar = $derived(initials(name));
</script>

<button
	bind:this={element}
	type="button"
	aria-pressed={active}
	{onclick}
	class="group relative flex h-10 shrink-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-[13px] font-medium whitespace-nowrap"
>
	<span
		class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[12px] text-ink"
	>
		{avatar}
		{#if unread}
			<span
				aria-hidden="true"
				class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink"
				transition:scale={{ start: 0.8, duration: 160, easing: cubicOut }}
			></span>
		{/if}
	</span>
	<span
		class="mix-blend-difference transition-colors duration-200 ease-soft {active
			? 'text-white'
			: 'text-white/55 group-hover:text-white'}"
	>
		{name}
	</span>
</button>
