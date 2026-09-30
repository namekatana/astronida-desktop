<script lang="ts">
	interface Props {
		value: string;
		max: number;
	}

	let { value, max }: Props = $props();

	const warnFrom = 10;

	const length = $derived(value.length);
	const visible = $derived(max - length <= warnFrom);
</script>

<span
	aria-hidden="true"
	class="pointer-events-none shrink-0 text-[12px] text-muted tabular-nums transition-opacity duration-150 {visible
		? 'opacity-100'
		: 'opacity-0'}"
>
	{length}/{max}
</span>
