<script lang="ts">
	interface Props {
		names: string[];
	}

	let { names }: Props = $props();

	const label = $derived.by(() => {
		if (names.length === 0) return '';
		if (names.length === 1) return `@${names[0]} печатает`;
		if (names.length === 2) return `@${names[0]} и @${names[1]} печатают`;
		return `${names.length} человека печатают`;
	});
</script>

<div
	aria-live="polite"
	class="pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-end gap-1.5 bg-gradient-to-t from-surface-deep via-surface-deep/80 to-transparent px-4 pb-1.5 text-[12px] text-muted transition-opacity duration-200 {label
		? 'opacity-100'
		: 'opacity-0'}"
>
	<span class="truncate leading-4">{label}</span>
	{#if label}
		<span class="typing-dots mb-1.5 flex shrink-0 items-center gap-0.5" aria-hidden="true">
			<span></span><span></span><span></span>
		</span>
	{/if}
</div>
