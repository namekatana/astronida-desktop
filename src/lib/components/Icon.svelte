<script lang="ts">
	import { iconPaths, type IconName } from '$lib/ui/icons';

	interface Props {
		name: IconName;
		size?: number;
		class?: string;
	}

	let { name, size = 16, class: className = '' }: Props = $props();

	const strokeWidth = $derived(1.5 * (16 / size));
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class="shrink-0 {className}"
>
	{#each iconPaths[name] as d (d)}
		<path {d} />
	{/each}
</svg>
