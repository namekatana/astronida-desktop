<script lang="ts">
	interface Props {
		progress?: number;
		size?: number;
		label?: string;
		class?: string;
	}

	let { progress, size = 36, label, class: className = '' }: Props = $props();

	const minimumShare = 0.06;
	const indeterminateShare = 0.28;
	const compactSize = 24;

	const clamped = $derived(progress === undefined ? 0 : Math.min(1, Math.max(0, progress)));
	const share = $derived(
		progress === undefined ? indeterminateShare : Math.max(minimumShare, clamped)
	);
	const compact = $derived(size < compactSize);
</script>

<span
	role={label ? 'progressbar' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	aria-valuemin={label && progress !== undefined ? 0 : undefined}
	aria-valuemax={label && progress !== undefined ? 100 : undefined}
	aria-valuenow={label && progress !== undefined ? Math.round(clamped * 100) : undefined}
	class="orbit relative block shrink-0 {compact ? 'orbit-compact' : ''} {className}"
	style="width: {size}px; height: {size}px; --orbit-angle: {share * 360}deg"
>
	<span class="orbit-ring orbit-track absolute inset-0 rounded-full"></span>
	<span class="orbit-spin absolute inset-0">
		<span class="orbit-ring orbit-tail absolute inset-0 rounded-full"></span>
		<span class="orbit-head absolute inset-0"></span>
	</span>
	{#if !compact}
		<span class="orbit-planet absolute top-1/2 left-1/2 rounded-full"></span>
	{/if}
</span>
