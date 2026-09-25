<script lang="ts">
	import { on } from 'svelte/events';

	interface Props {
		target: HTMLElement | undefined;
	}

	let { target }: Props = $props();

	const minThumb = 28;
	const idleMs = 900;
	const inset = 6;

	let trackHeight = $state(0);
	let thumbHeight = $state(0);
	let thumbOffset = $state(0);
	let overflowing = $state(false);
	let active = $state(false);
	let hovered = $state(false);
	let dragging = $state(false);

	let idleTimer = 0;
	let dragStartY = 0;
	let dragStartTop = 0;

	function measure() {
		if (!target) return;
		const { scrollTop, scrollHeight, clientHeight } = target;
		overflowing = scrollHeight > clientHeight + 1;
		trackHeight = clientHeight - inset * 2;
		if (!overflowing) return;
		thumbHeight = Math.max(minThumb, (clientHeight / scrollHeight) * trackHeight);
		const range = trackHeight - thumbHeight;
		const progress = scrollTop / (scrollHeight - clientHeight);
		thumbOffset = progress * range;
	}

	function wake() {
		active = true;
		clearTimeout(idleTimer);
		idleTimer = window.setTimeout(() => (active = false), idleMs);
	}

	$effect(() => {
		if (!target) return;
		measure();
		const resize = new ResizeObserver(measure);
		resize.observe(target);
		const mutation = new MutationObserver(measure);
		mutation.observe(target, { childList: true, subtree: true });
		const offScroll = on(
			target,
			'scroll',
			() => {
				measure();
				wake();
			},
			{ passive: true }
		);
		return () => {
			resize.disconnect();
			mutation.disconnect();
			offScroll();
			clearTimeout(idleTimer);
		};
	});

	function handleThumbPointerDown(event: PointerEvent) {
		if (!target) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragging = true;
		dragStartY = event.clientY;
		dragStartTop = target.scrollTop;
	}

	function handleThumbPointerMove(event: PointerEvent) {
		if (!dragging || !target) return;
		const range = trackHeight - thumbHeight;
		if (range <= 0) return;
		const scrollRange = target.scrollHeight - target.clientHeight;
		target.scrollTop = dragStartTop + ((event.clientY - dragStartY) / range) * scrollRange;
	}

	function handleThumbPointerUp() {
		dragging = false;
	}

	function handleTrackPointerDown(event: PointerEvent) {
		if (!target || event.target !== event.currentTarget) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const clickY = event.clientY - rect.top;
		const direction = clickY < thumbOffset ? -1 : 1;
		target.scrollBy({ top: direction * target.clientHeight * 0.9, behavior: 'smooth' });
	}

	const visible = $derived(overflowing && (active || hovered || dragging));
</script>

{#if overflowing}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		aria-hidden="true"
		onpointerenter={() => (hovered = true)}
		onpointerleave={() => (hovered = false)}
		onpointerdown={handleTrackPointerDown}
		class="absolute top-0 right-0 bottom-0 w-3 transition-opacity duration-200 {visible
			? 'opacity-100'
			: 'opacity-0'}"
		style="padding: {inset}px 0"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onpointerdown={handleThumbPointerDown}
			onpointermove={handleThumbPointerMove}
			onpointerup={handleThumbPointerUp}
			onpointercancel={handleThumbPointerUp}
			class="absolute right-1 w-1.5 origin-right rounded-full transition-[background-color,scale] duration-150 {dragging
				? 'scale-x-[1.3333] bg-white/[0.3]'
				: 'bg-white/[0.14] hover:scale-x-[1.3333] hover:bg-white/[0.24]'}"
			style="top: {inset}px; height: {thumbHeight}px; translate: 0 {thumbOffset}px;"
		></div>
	</div>
{/if}
