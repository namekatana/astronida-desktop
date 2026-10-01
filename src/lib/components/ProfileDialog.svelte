<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut, quartOut, quintOut } from 'svelte/easing';
	import { on } from 'svelte/events';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import type { ProfileCard } from '$lib/profile/profile';
	import { materialize } from '$lib/ui/materialize';
	import Icon from './Icon.svelte';
	import ProfileContent from './ProfileContent.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		card: ProfileCard;
		source: HTMLElement | null;
		onclose: () => void;
	}

	let { card, source, onclose }: Props = $props();

	const origin = untrack(() => source);

	const growMs = 420;
	const returnMs = 320;
	const cometDelayMs = 300;
	const quintOutCurve = 'cubic-bezier(0.22, 1, 0.36, 1)';
	const quartOutCurve = 'cubic-bezier(0.25, 1, 0.5, 1)';

	let dialog = $state<HTMLDivElement | null>(null);
	let content = $state<ReturnType<typeof ProfileContent>>();

	interface Flight {
		origin: string;
		x: number;
		y: number;
		scale: number;
	}

	function isClipped(rect: DOMRect, element: HTMLElement): boolean {
		for (let parent = element.parentElement; parent; parent = parent.parentElement) {
			const style = getComputedStyle(parent);
			if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
			const bounds = parent.getBoundingClientRect();
			if (
				rect.top < bounds.top ||
				rect.bottom > bounds.bottom ||
				rect.left < bounds.left ||
				rect.right > bounds.right
			) {
				return true;
			}
		}
		return false;
	}

	function visibleRectOf(element: HTMLElement | null): DOMRect | null {
		if (!element?.isConnected) return null;
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 || isClipped(rect, element)) return null;
		return rect;
	}

	function offsetWithin(element: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
		let x = 0;
		let y = 0;
		let current: Element | null = element;
		while (current instanceof HTMLElement && current !== ancestor) {
			x += current.offsetLeft;
			y += current.offsetTop;
			current = current.offsetParent;
		}
		return { x, y };
	}

	function flightBetween(node: HTMLElement, home: DOMRect): Flight | null {
		const avatar = node.querySelector<HTMLElement>('[data-avatar]');
		const layer = node.offsetParent;
		if (!avatar || !(layer instanceof HTMLElement)) return null;
		const layerBox = layer.getBoundingClientRect();
		const offset = offsetWithin(avatar, node);
		const originX = offset.x + avatar.offsetWidth / 2;
		const originY = offset.y + avatar.offsetHeight / 2;
		return {
			origin: `${originX}px ${originY}px`,
			x: home.left + home.width / 2 - (layerBox.left + node.offsetLeft + originX),
			y: home.top + home.height / 2 - (layerBox.top + node.offsetTop + originY),
			scale: home.width / avatar.offsetWidth
		};
	}

	function isTransparent(color: string): boolean {
		return color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
	}

	function faceOf(element: Element): Element | null {
		for (const candidate of [element, ...element.querySelectorAll('*')]) {
			if (!isTransparent(getComputedStyle(candidate).backgroundColor)) return candidate;
		}
		return null;
	}

	type AnimatedProperty = 'opacity' | 'transform' | 'backgroundColor' | 'boxShadow';

	const noRing = '0 0 0 0 transparent';

	function animateOnwards(
		element: Element,
		target: Partial<Record<AnimatedProperty, string>>,
		timing: KeyframeAnimationOptions
	) {
		const current = getComputedStyle(element);
		const start: Partial<Record<AnimatedProperty, string>> = {};
		for (const property of Object.keys(target) as AnimatedProperty[]) {
			start[property] = current[property];
		}
		for (const animation of element.getAnimations()) animation.cancel();
		element.animate([start, target], timing);
	}

	function sourceLook(node: HTMLElement, flight: Flight) {
		const face = node.querySelector('[data-avatar-face]');
		const initials = node.querySelector('[data-avatar-initials]');
		const sourceFace = origin ? faceOf(origin) : null;
		if (!face || !initials || !sourceFace) return null;
		const source = getComputedStyle(sourceFace);
		const textScale =
			parseFloat(source.fontSize) / (parseFloat(getComputedStyle(face).fontSize) * flight.scale);
		return { face, initials, color: source.backgroundColor, textSize: `scale(${textScale})` };
	}

	function growFace(node: HTMLElement, flight: Flight) {
		const look = sourceLook(node, flight);
		if (!look) return;
		const timing = { duration: growMs, easing: quintOutCurve };
		const own = getComputedStyle(look.face);
		look.face.animate(
			[
				{ backgroundColor: look.color, boxShadow: noRing },
				{ backgroundColor: own.backgroundColor, boxShadow: own.boxShadow }
			],
			timing
		);
		look.initials.animate([{ transform: look.textSize }, { transform: 'scale(1)' }], timing);
	}

	function shrinkFace(node: HTMLElement, flight: Flight, timing: KeyframeAnimationOptions) {
		const look = sourceLook(node, flight);
		if (!look) return;
		animateOnwards(look.face, { backgroundColor: look.color, boxShadow: noRing }, timing);
		animateOnwards(look.initials, { transform: look.textSize }, timing);
	}

	function fadeComet(node: HTMLElement) {
		const comet = node.querySelector('[data-avatar-stage] svg');
		if (comet) animateOnwards(comet, { opacity: '0' }, { duration: 150, easing: 'ease-out', fill: 'forwards' });
	}

	function settleDot(node: HTMLElement, flight: Flight, home: DOMRect, timing: KeyframeAnimationOptions) {
		const dot = node.querySelector<HTMLElement>('[data-avatar-dot]');
		const avatar = node.querySelector<HTMLElement>('[data-avatar]');
		if (!dot || !avatar) return;
		const target = origin?.querySelector('[data-avatar-dot]');
		if (!target || getComputedStyle(target).opacity === '0') {
			animateOnwards(dot, { opacity: '0' }, timing);
			return;
		}
		const goal = target.getBoundingClientRect();
		const offset = offsetWithin(dot, avatar);
		const offsetX = offset.x + dot.offsetWidth / 2 - avatar.offsetWidth / 2;
		const offsetY = offset.y + dot.offsetHeight / 2 - avatar.offsetHeight / 2;
		const shiftX =
			(goal.left + goal.width / 2 - (home.left + home.width / 2) - offsetX * flight.scale) /
			flight.scale;
		const shiftY =
			(goal.top + goal.height / 2 - (home.top + home.height / 2) - offsetY * flight.scale) /
			flight.scale;
		const resize = goal.width / (dot.offsetWidth * flight.scale);
		const opacity = getComputedStyle(dot).opacity;
		for (const animation of dot.getAnimations()) animation.cancel();
		dot.animate(
			[
				{ opacity, transform: 'none' },
				{ opacity: '1', transform: `translate(${shiftX}px, ${shiftY}px) scale(${resize})` }
			],
			timing
		);
	}

	function growFromSource(node: HTMLElement): TransitionConfig {
		const home = prefersReducedMotion.current ? null : visibleRectOf(origin);
		const flight = home ? flightBetween(node, home) : null;
		if (!flight) return materialize(node, { y: 8, scale: 0.96, blur: 4, duration: 280 });
		growFace(node, flight);
		return {
			duration: growMs,
			easing: quintOut,
			css: (t, u) =>
				`transform-origin: ${flight.origin}; transform: translate(${flight.x * u}px, ${flight.y * u}px) scale(${flight.scale + (1 - flight.scale) * t})`
		};
	}

	function shrinkToSource(node: HTMLElement): TransitionConfig {
		content?.showStatusNow();
		const home = prefersReducedMotion.current ? null : visibleRectOf(origin);
		const flight = home ? flightBetween(node, home) : null;
		if (!flight) {
			return materialize(node, { y: 4, scale: 0.98, blur: 2, duration: 180, easing: cubicOut });
		}
		const timing = { duration: returnMs, easing: quartOutCurve, fill: 'forwards' } as const;
		fadeComet(node);
		shrinkFace(node, flight, timing);
		if (home) settleDot(node, flight, home, timing);
		return {
			duration: returnMs,
			easing: quartOut,
			css: (_t, u) =>
				`transform-origin: ${flight.origin}; transform: translate(${flight.x * u}px, ${flight.y * u}px) scale(${1 + (flight.scale - 1) * u})`
		};
	}

	function reveal(node: Element): TransitionConfig {
		return { ...materialize(node, { blur: 4, duration: 280 }), delay: 140 };
	}

	$effect(() => {
		const hidden = origin;
		if (!hidden) return;
		hidden.style.visibility = 'hidden';
		return () => {
			hidden.style.visibility = '';
		};
	});

	$effect(() => {
		dialog?.focus({ preventScroll: true });
	});

	$effect(() => {
		return on(document, 'keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			onclose();
		});
	});
</script>

<button
	type="button"
	tabindex="-1"
	aria-label="Закрыть профиль"
	onclick={onclose}
	transition:fade={{ duration: 200 }}
	class="absolute inset-0 z-40 cursor-default bg-bg/70"
></button>

<div class="pointer-events-none absolute inset-0 z-40 flex flex-col items-center px-8 py-6">
	<div class="grow-[2]"></div>
	<div
		bind:this={dialog}
		role="dialog"
		aria-modal="true"
		aria-label="Профиль @{card.target.username}"
		tabindex="-1"
		in:growFromSource
		out:shrinkToSource
		class="pointer-events-auto relative flex max-h-full min-h-0 w-full max-w-[340px] flex-col outline-none will-change-transform"
	>
		<div
			class="panel panel-floating absolute inset-0"
			in:fade={{ duration: 220 }}
			out:fade={{ duration: 100 }}
		></div>

		<SmoothScroll class="relative min-h-0 flex-1" contentClass="flex flex-col items-center p-1.5 pb-4">
			<ProfileContent bind:this={content} {card} cometDelay={cometDelayMs} animated />
		</SmoothScroll>

		<button
			type="button"
			aria-label="Закрыть"
			onclick={onclose}
			in:reveal
			out:fade={{ duration: 120 }}
			class="pressable absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.08] hover:text-ink"
		>
			<Icon name="close" size={14} />
		</button>
	</div>
	<div class="grow-[3]"></div>
</div>
