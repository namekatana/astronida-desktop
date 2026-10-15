<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import ServerIcon from './ServerIcon.svelte';

	interface Props {
		serverId: string;
		iconId?: string | null;
		name: string;
		active?: boolean;
		unread?: boolean;
		onclick?: () => void;
		element?: HTMLButtonElement;
	}

	let {
		serverId,
		iconId,
		name,
		active = false,
		unread = false,
		onclick,
		element = $bindable()
	}: Props = $props();
</script>

<button
	bind:this={element}
	type="button"
	aria-pressed={active}
	title={name}
	{onclick}
	class="group relative flex h-10 shrink-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-[13px] font-medium whitespace-nowrap"
>
	<span
		class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[12px] text-ink"
	>
		<ServerIcon {serverId} {iconId} {name} />
		{#if unread}
			<span
				aria-hidden="true"
				class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink"
				transition:scale={{ start: 0.8, duration: 160, easing: cubicOut }}
			></span>
		{/if}
	</span>
	<span
		class="max-w-[160px] truncate [mix-blend-mode:var(--tab-label-blend,difference)] transition-colors duration-200 ease-soft {active
			? 'text-tab-label-active'
			: 'text-tab-label/55 group-hover:text-tab-label'}"
	>
		{name}
	</span>
</button>
