<script lang="ts">
	interface Props {
		name: string;
		active?: boolean;
		onclick?: () => void;
		element?: HTMLButtonElement;
	}

	let { name, active = false, onclick, element = $bindable() }: Props = $props();

	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase() ?? '')
			.join('')
	);
</script>

<button
	bind:this={element}
	type="button"
	aria-pressed={active}
	{onclick}
	class="group relative flex h-10 shrink-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-[13px] font-medium whitespace-nowrap transition-transform duration-200 ease-soft active:scale-[1.04]"
>
	<span
		class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[12px] text-ink"
	>
		{initials}
	</span>
	<span
		class="mix-blend-difference transition-colors duration-200 ease-soft {active
			? 'text-white'
			: 'text-white/55 group-hover:text-white'}"
	>
		{name}
	</span>
</button>
