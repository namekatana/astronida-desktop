<script lang="ts">
	interface Props {
		side: 'left' | 'right';
		width: number;
		min: number;
		max: number;
	}

	let { side, width = $bindable(), min, max }: Props = $props();

	let dragging = $state(false);
	let startX = 0;
	let startWidth = 0;

	function handlePointerDown(event: PointerEvent) {
		if (event.currentTarget instanceof HTMLElement) {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		dragging = true;
		startX = event.clientX;
		startWidth = width;
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging) return;
		const delta = event.clientX - startX;
		const next = side === 'right' ? startWidth + delta : startWidth - delta;
		width = Math.min(max, Math.max(min, next));
	}

	function handlePointerUp() {
		dragging = false;
	}
</script>

<div
	role="separator"
	aria-orientation="vertical"
	aria-valuenow={width}
	aria-valuemin={min}
	aria-valuemax={max}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
	class="group absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none {side === 'right'
		? '-right-1'
		: '-left-1'}"
>
	<span
		class="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-line-strong transition-opacity duration-150 {dragging
			? 'opacity-60'
			: 'opacity-0 group-hover:opacity-40'}"
	></span>
</div>
