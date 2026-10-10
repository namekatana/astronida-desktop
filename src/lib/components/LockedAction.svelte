<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		label: string;
	}

	let { label }: Props = $props();
</script>

<span
	aria-disabled="true"
	title="Скоро"
	class="flex h-8 shrink-0 cursor-default items-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-[12px] font-semibold text-muted"
>
	<Icon name="lock" size={12} />
	<span class="opacity-60">{label}</span>
</span>
