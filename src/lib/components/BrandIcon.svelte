<script lang="ts">
	import { brandPaths, type BrandName } from '$lib/ui/brands';

	interface Props {
		name: BrandName;
		size?: number;
		class?: string;
	}

	let { name, size = 16, class: className = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="currentColor"
	aria-hidden="true"
	class="shrink-0 {className}"
>
	<path d={brandPaths[name]} />
</svg>
