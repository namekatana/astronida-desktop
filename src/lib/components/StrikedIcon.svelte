<script lang="ts">
	import type { IconName } from '$lib/ui/icons';
	import Icon from './Icon.svelte';

	interface Props {
		name: IconName;
		size?: number;
		class?: string;
	}

	let { name, size = 12, class: className = '' }: Props = $props();
</script>

<span class="relative inline-flex {className}">
	<Icon {name} {size} />
	<svg
		width={size}
		height={size}
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
		stroke-linecap="round"
		aria-hidden="true"
		class="absolute inset-0"
	>
		<path d="M3 3l10 10" class="stroke-surface" stroke-width="4" />
		<path d="M3 3l10 10" />
	</svg>
</span>
