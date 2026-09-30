<script lang="ts">
	import type { Snippet } from 'svelte';
	import { initials } from '$lib/ui/initials';

	type AvatarSize = 24 | 28 | 32 | 72;

	interface Props {
		name: string;
		size: AvatarSize;
		online?: boolean;
		class?: string;
		children?: Snippet;
	}

	let { name, size, online, class: className = '', children }: Props = $props();

	const sizeClasses: Record<AvatarSize, string> = {
		24: 'h-6 w-6 text-[10px]',
		28: 'h-7 w-7 text-[11px]',
		32: 'h-8 w-8 text-[11px]',
		72: 'h-[72px] w-[72px] text-[22px]'
	};

	const circleClass = $derived(
		`flex shrink-0 items-center justify-center rounded-full bg-surface-raised font-medium text-ink ${sizeClasses[size]}`
	);
</script>

{#if online === undefined}
	<span class="{circleClass} {className}">
		{initials(name)}
		{@render children?.()}
	</span>
{:else}
	<span class="relative shrink-0 {className}">
		<span class={circleClass}>{initials(name)}</span>
		<span
			class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-online transition-[opacity,scale] duration-200 ease-soft {online
				? 'scale-100 opacity-100'
				: 'scale-50 opacity-0'}"
		></span>
	</span>
{/if}
