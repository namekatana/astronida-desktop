<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { createSmoothScroll, type ScrollAxis, type SmoothScrollController } from '$lib/ui/smooth-scroll';
	import Scrollbar from './Scrollbar.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
		axis?: ScrollAxis;
		class?: string;
		viewportClass?: string;
		contentClass?: string;
		scrollbar?: boolean;
		disabled?: boolean;
		viewport?: HTMLDivElement;
		controller?: SmoothScrollController;
		children: Snippet;
	}

	let {
		axis = 'y',
		class: className = '',
		viewportClass = '',
		contentClass = '',
		scrollbar = false,
		disabled = false,
		viewport = $bindable(),
		controller = $bindable(),
		children,
		...rest
	}: Props = $props();

	let content = $state<HTMLDivElement>();

	$effect(() => {
		if (!viewport || !content) return;
		const created = createSmoothScroll(viewport, content, { axis, isDisabled: () => disabled });
		controller = created;
		return () => {
			created.destroy();
			controller = undefined;
		};
	});

	const overflowClass = $derived(
		disabled ? 'overflow-hidden' : axis === 'y' ? 'overflow-y-auto' : 'overflow-x-auto'
	);
</script>

<div class="relative flex {axis === 'y' ? 'flex-col' : ''} {className}">
	<div
		bind:this={viewport}
		{...rest}
		class="scrollbar-none min-h-0 min-w-0 flex-1 {overflowClass} {viewportClass}"
	>
		<div bind:this={content} class={contentClass}>
			{@render children()}
		</div>
	</div>
	{#if scrollbar && axis === 'y'}
		<Scrollbar target={viewport} {controller} />
	{/if}
</div>
