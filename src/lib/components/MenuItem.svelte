<script lang="ts">
	import type { IconName } from '$lib/ui/icons';
	import Icon from './Icon.svelte';

	interface Props {
		icon: IconName;
		label: string;
		onclick: () => void;
		destructive?: boolean;
		checked?: boolean;
		disabled?: boolean;
		hint?: string;
	}

	let {
		icon,
		label,
		onclick,
		destructive = false,
		checked,
		disabled = false,
		hint
	}: Props = $props();
</script>

<button
	type="button"
	role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
	aria-checked={checked}
	{disabled}
	{onclick}
	class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-150 enabled:hover:bg-white/[0.06] disabled:cursor-default {checked
		? 'text-ink'
		: 'text-ink-secondary'} {disabled
		? 'opacity-50'
		: destructive
			? 'enabled:hover:text-danger'
			: 'enabled:hover:text-ink'}"
>
	<Icon name={icon} size={15} class={checked ? 'text-ink' : 'text-muted'} />
	<span class="min-w-0 flex-1 truncate">{label}</span>
	{#if hint}
		<span class="shrink-0 text-[11px] text-muted">{hint}</span>
	{:else if checked}
		<Icon name="check" size={14} class="text-ink" />
	{/if}
</button>
