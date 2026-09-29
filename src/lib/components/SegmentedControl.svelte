<script lang="ts" generics="T">
	interface Props {
		label: string;
		options: { value: T; label: string }[];
		value: T;
		disabled?: boolean;
	}

	let { label, options, value = $bindable(), disabled = false }: Props = $props();

	let buttons = $state<HTMLButtonElement[]>([]);

	const selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);

	function select(index: number) {
		if (disabled) return;
		value = options[index].value;
	}

	function handleKeydown(event: KeyboardEvent) {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (step === 0) return;
		event.preventDefault();
		const next = (selectedIndex + step + options.length) % options.length;
		select(next);
		buttons[next]?.focus();
	}
</script>

<div
	role="tablist"
	aria-label={label}
	tabindex="-1"
	onkeydown={handleKeydown}
	class="relative grid h-10 rounded-full bg-white/[0.05] p-1"
	style:grid-template-columns="repeat({options.length}, minmax(0, 1fr))"
>
	<span
		aria-hidden="true"
		class="absolute inset-y-1 left-1 rounded-full bg-white/[0.12] transition-[translate] duration-200 ease-move motion-reduce:transition-none"
		style:width="calc((100% - 0.5rem) / {options.length})"
		style:translate="{selectedIndex * 100}% 0"
	></span>
	{#each options as option, index (option.value)}
		<button
			bind:this={buttons[index]}
			type="button"
			role="tab"
			aria-selected={index === selectedIndex}
			tabindex={index === selectedIndex ? 0 : -1}
			{disabled}
			onclick={() => select(index)}
			class="relative truncate rounded-full px-3 text-[13px] font-medium transition-colors duration-200 disabled:pointer-events-none {index ===
			selectedIndex
				? 'text-ink'
				: 'text-muted hover:text-ink-secondary'}"
		>
			{option.label}
		</button>
	{/each}
</div>
