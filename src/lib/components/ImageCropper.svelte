<script lang="ts">
	import { cubicOut, quartOut, quintOut } from 'svelte/easing';
	import { on } from 'svelte/events';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import type { CropArea } from '$lib/media/encode-webp';
	import type { CropFrame, CropSource } from '$lib/profile/image-editor.svelte';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';

	interface Props {
		source: CropSource;
		frame: CropFrame;
		exit: 'apply' | 'cancel';
		targetRect: () => DOMRect | null;
	}

	let { source, frame, exit, targetRect }: Props = $props();

	const maxZoom = 4;
	const wheelSensitivity = 0.0015;
	const growMs = 420;
	const shrinkMs = 320;
	const dissolveMs = 200;
	const glideMs = 460;
	const glideDelayMs = 80;
	const glideBackMs = 340;
	const surfaceRgb = '24 24 27';
	const shadeAlpha = 0.8;

	let stage = $state<HTMLDivElement | null>(null);
	let zoom = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let dragging = $state(false);
	let turns = $state(0);

	const baseScale = $derived(
		Math.max(frame.width / source.width, frame.height / source.height)
	);
	const scale = $derived(baseScale * zoom);
	const zoomFill = $derived(((zoom - 1) / (maxZoom - 1)) * 100);
	const quarterTurns = $derived(((turns % 4) + 4) % 4);
	const turnCos = $derived(Math.round(Math.cos((-quarterTurns * Math.PI) / 2)));
	const turnSin = $derived(Math.round(Math.sin((-quarterTurns * Math.PI) / 2)));
	const isCircle = $derived(frame.width === frame.height && frame.radius * 2 >= frame.width);
	const undersized = $derived(
		frame.minimum !== undefined && frame.width / scale < frame.minimum.width
	);

	export function cropArea(): CropArea {
		const width = frame.width / scale;
		const height = frame.height / scale;
		return {
			x: source.width / 2 - offsetX / scale - width / 2,
			y: source.height / 2 - offsetY / scale - height / 2,
			width,
			height,
			quarterTurns
		};
	}

	function toImageSpace(x: number, y: number): { x: number; y: number } {
		return { x: x * turnCos + y * turnSin, y: -x * turnSin + y * turnCos };
	}

	function rotateLeft() {
		turns += 1;
	}

	function place(x: number, y: number, nextZoom: number) {
		const nextScale = baseScale * nextZoom;
		const limitX = (source.width * nextScale - frame.width) / 2;
		const limitY = (source.height * nextScale - frame.height) / 2;
		zoom = nextZoom;
		offsetX = Math.max(-limitX, Math.min(limitX, x));
		offsetY = Math.max(-limitY, Math.min(limitY, y));
	}

	function zoomAround(nextZoom: number, pointX: number, pointY: number) {
		const bounded = Math.max(1, Math.min(maxZoom, nextZoom));
		const ratio = bounded / zoom;
		place(pointX - (pointX - offsetX) * ratio, pointY - (pointY - offsetY) * ratio, bounded);
	}

	const still: TransitionConfig = { duration: 0 };

	function lens(node: HTMLElement, duration: number): TransitionConfig {
		const from = prefersReducedMotion.current ? null : targetRect();
		if (!from) return { duration: 180, css: (t) => `opacity: ${t}` };
		const box = node.getBoundingClientRect();
		const shiftX = from.left + from.width / 2 - (box.left + box.width / 2);
		const shiftY = from.top + from.height / 2 - (box.top + box.height / 2);
		const startScale = from.width / frame.width;
		const startRadius = frame.width / 2;
		const fullRadius = Math.hypot(box.width, box.height) / 2;
		return {
			duration,
			easing: quintOut,
			css: (t, u) =>
				`transform: translate(${shiftX * u}px, ${shiftY * u}px) scale(${startScale + (1 - startScale) * t}); clip-path: circle(${startRadius + (fullRadius - startRadius) * t * t}px at 50% 50%)`
		};
	}

	function dissolve(): TransitionConfig {
		return {
			duration: dissolveMs,
			easing: cubicOut,
			css: (t) => `opacity: ${t}; transform: scale(${0.96 + 0.04 * t})`
		};
	}

	function stageIn(node: HTMLElement): TransitionConfig {
		if (isCircle) return lens(node, growMs);
		return { duration: 150, css: (t) => `opacity: ${t}` };
	}

	function stageOut(node: HTMLElement): TransitionConfig {
		if (exit === 'cancel') return dissolve();
		if (isCircle) return lens(node, shrinkMs);
		return { duration: glideBackMs, css: (t) => `opacity: ${Math.min(1, t / 0.35)}` };
	}

	function glideFrom(node: HTMLElement): { x: number; y: number; scale: number } | null {
		if (isCircle || prefersReducedMotion.current) return null;
		const from = targetRect();
		if (!from) return null;
		const box = node.getBoundingClientRect();
		return {
			x: from.left + from.width / 2 - (box.left + box.width / 2),
			y: from.top + from.height / 2 - (box.top + box.height / 2),
			scale: from.width / frame.width
		};
	}

	function glideCss(
		shift: { x: number; y: number; scale: number },
		withShade: boolean
	): (t: number, u: number) => string {
		return (_t, u) => {
			const motion = `transform: translate(${shift.x * u}px, ${shift.y * u}px) scale(${1 + (shift.scale - 1) * u})`;
			if (!withShade) return motion;
			const alpha = shadeAlpha + (1 - shadeAlpha) * u;
			return `${motion}; box-shadow: 0 0 0 9999px rgb(${surfaceRgb} / ${alpha})`;
		};
	}

	function heldQuintOut(progress: number): number {
		const hold = glideDelayMs / (glideDelayMs + glideMs);
		return quintOut(Math.max(0, (progress - hold) / (1 - hold)));
	}

	function glideIn(node: HTMLElement, withShade: boolean): TransitionConfig {
		const shift = glideFrom(node);
		if (!shift) return still;
		return {
			duration: glideDelayMs + glideMs,
			easing: heldQuintOut,
			css: glideCss(shift, withShade)
		};
	}

	function glideOut(node: HTMLElement, withShade: boolean): TransitionConfig {
		const shift = exit === 'apply' ? glideFrom(node) : null;
		if (!shift) return still;
		return { duration: glideBackMs, easing: quartOut, css: glideCss(shift, withShade) };
	}

	function photoIn(node: HTMLElement): TransitionConfig {
		return glideIn(node, false);
	}

	function photoOut(node: HTMLElement): TransitionConfig {
		return glideOut(node, false);
	}

	function frameIn(node: HTMLElement): TransitionConfig {
		return glideIn(node, true);
	}

	function frameOut(node: HTMLElement): TransitionConfig {
		return glideOut(node, true);
	}

	$effect(() => {
		const element = stage;
		if (!element) return;
		let start: { pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null =
			null;

		const offDown = on(element, 'pointerdown', (event) => {
			if (event.button !== 0) return;
			element.setPointerCapture(event.pointerId);
			start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX, offsetY };
			dragging = true;
		});
		const offMove = on(element, 'pointermove', (event) => {
			if (!start || event.pointerId !== start.pointerId) return;
			const shift = toImageSpace(event.clientX - start.x, event.clientY - start.y);
			place(start.offsetX + shift.x, start.offsetY + shift.y, zoom);
		});
		const finish = (event: PointerEvent) => {
			if (!start || event.pointerId !== start.pointerId) return;
			start = null;
			dragging = false;
		};
		const offUp = on(element, 'pointerup', finish);
		const offCancel = on(element, 'pointercancel', finish);
		const offWheel = on(
			element,
			'wheel',
			(event) => {
				event.preventDefault();
				const rect = element.getBoundingClientRect();
				const point = toImageSpace(
					event.clientX - (rect.left + rect.width / 2),
					event.clientY - (rect.top + rect.height / 2)
				);
				zoomAround(zoom * Math.exp(-event.deltaY * wheelSensitivity), point.x, point.y);
			},
			{ passive: false }
		);

		return () => {
			offDown();
			offMove();
			offUp();
			offCancel();
			offWheel();
		};
	});

	$effect(() => {
		if (!frame.rotatable) return;
		return on(window, 'keydown', (event) => {
			if (event.code !== 'KeyR' || event.repeat || event.defaultPrevented) return;
			if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
			event.preventDefault();
			rotateLeft();
		});
	});
</script>

<div class="absolute inset-0 flex flex-col p-1.5">
	<div
		class="absolute inset-0 rounded-[18px] bg-surface [corner-shape:squircle]"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 200, delay: 60 }}
	></div>

	<div
		bind:this={stage}
		in:stageIn
		out:stageOut
		class="relative min-h-0 flex-1 touch-none overflow-hidden rounded-[12px] select-none [corner-shape:squircle] {dragging
			? 'cursor-grabbing'
			: 'cursor-grab'}"
	>
		<div
			class="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 transition-[rotate] duration-300 ease-soft motion-reduce:transition-none"
			style:height="{frame.height}px"
			style:rotate="{-turns * 90}deg"
			in:photoIn
			out:photoOut
		>
			<img
				src={source.url}
				alt=""
				draggable="false"
				class="absolute top-1/2 left-1/2 max-w-none will-change-transform"
				style:width="{source.width}px"
				style:height="{source.height}px"
				style:transform="translate(-50%, -50%) translate({offsetX}px, {offsetY}px) scale({scale})"
			/>
		</div>
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 outline-1 -outline-offset-1 outline-white/30"
			style:width="{frame.width}px"
			style:height="{frame.height}px"
			style:border-radius="{frame.radius}px"
			style:box-shadow="0 0 0 9999px rgb({surfaceRgb} / {shadeAlpha})"
			in:frameIn
			out:frameOut
		></div>
		{#if frame.minimum}
			<div
				class="pointer-events-none absolute inset-x-0 grid justify-items-center px-4"
				style:top="calc(50% + {frame.height / 2 + 12}px)"
			>
				{#if undersized}
					<p
						class="col-start-1 row-start-1 flex h-7 items-center gap-1.5 rounded-full bg-black/45 pr-3 pl-2.5 text-[12px] font-medium text-ink-secondary"
						in:settle
						out:settle={{ duration: 100 }}
					>
						<Icon name="info" size={13} class="text-ink-secondary" />
						{frame.minimum.notice}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<div
		class="relative flex h-12 shrink-0 items-center gap-3 pl-4 {frame.rotatable ? 'pr-2' : 'pr-4'}"
		in:fade={{ duration: 200, delay: 160 }}
		out:fade={{ duration: 100 }}
	>
		<Icon name="image" size={12} class="text-muted" />
		<input
			type="range"
			min="1"
			max={maxZoom}
			step="0.01"
			value={zoom}
			aria-label="Масштаб"
			oninput={(event) => zoomAround(event.currentTarget.valueAsNumber, 0, 0)}
			class="range block min-w-0 flex-1"
			style="--range-fill: {zoomFill}%"
		/>
		<Icon name="image" size={18} class="text-muted" />
		{#if frame.rotatable}
			<button
				type="button"
				aria-label="Повернуть влево"
				title="Повернуть (R)"
				onclick={rotateLeft}
				class="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.08] hover:text-ink"
			>
				<Icon name="rotate" size={16} />
			</button>
		{/if}
	</div>
</div>
