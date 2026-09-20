<script lang="ts">
	import { initials } from '$lib/ui/initials';

	interface Props {
		name: string;
		active?: boolean;
		onclick?: () => void;
		element?: HTMLButtonElement;
	}

	let { name, active = false, onclick, element = $bindable() }: Props = $props();

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
		class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[12px] text-ink"
	>
		{avatar}
	</span>
	<span
		class="mix-blend-difference transition-colors duration-200 ease-soft {active
			? 'text-white'
			: 'text-white/55 group-hover:text-white'}"
	>
		{name}
	</span>
</button>
