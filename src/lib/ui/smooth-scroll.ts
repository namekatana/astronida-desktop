import { prefersReducedMotion } from 'svelte/motion';

export type ScrollAxis = 'x' | 'y';

export interface SmoothScrollController {
	readonly position: number;
	scrollTo(offset: number, options?: { instant?: boolean }): void;
	stop(): void;
}

interface SmoothScrollOptions {
	axis: ScrollAxis;
	isDisabled: () => boolean;
}

interface Registration {
	viewport: HTMLElement;
	axis: ScrollAxis;
	scrollByKeyboard: (delta: number) => void;
	scrollToEdge: (edge: 'start' | 'end') => void;
}

const wheelSmoothingMs = 85;
const preciseSmoothingMs = 25;
const settleDistance = 0.25;
const longestFrameMs = 64;
const lineDeltaPx = 40;
const pageFactor = 0.875;
const notchDelta = 120;
const wheelLatchMs = 300;

const registrations = new Set<Registration>();
let lastActive: Registration | null = null;
let removeKeyListener: (() => void) | null = null;

function isEditable(element: Element | null): boolean {
	if (!(element instanceof HTMLElement)) return false;
	if (element.isContentEditable) return true;
	if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
	if (!(element instanceof HTMLInputElement)) return false;
	return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(element.type);
}

function activatesWithSpace(element: Element | null): boolean {
	if (!(element instanceof HTMLElement)) return false;
	return element.matches(
		'button, a[href], summary, input, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [role="tab"]'
	);
}

function isUncovered(viewport: HTMLElement): boolean {
	const box = viewport.getBoundingClientRect();
	const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
	return hit !== null && viewport.contains(hit);
}

function innermostContaining(element: Element): Registration | null {
	let found: Registration | null = null;
	for (const registration of registrations) {
		if (registration.axis !== 'y' || !registration.viewport.contains(element)) continue;
		if (!found || found.viewport.contains(registration.viewport)) found = registration;
	}
	return found;
}

function keyboardTarget(): Registration | null {
	const focused = document.activeElement;
	if (focused && focused !== document.body) {
		const containing = innermostContaining(focused);
		if (containing) return containing;
	}
	if (lastActive && lastActive.viewport.isConnected && isUncovered(lastActive.viewport)) return lastActive;
	return null;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
	const focused = document.activeElement;
	if (isEditable(focused)) return;
	const target = keyboardTarget();
	if (!target) return;
	const page = target.viewport.clientHeight * pageFactor;
	let delta = 0;
	if (event.key === 'ArrowDown') delta = lineDeltaPx;
	else if (event.key === 'ArrowUp') delta = -lineDeltaPx;
	else if (event.key === 'PageDown') delta = page;
	else if (event.key === 'PageUp') delta = -page;
	else if (event.key === ' ' && !activatesWithSpace(focused)) delta = event.shiftKey ? -page : page;
	else if (event.key === 'Home' || event.key === 'End') {
		event.preventDefault();
		target.scrollToEdge(event.key === 'Home' ? 'start' : 'end');
		return;
	}
	if (delta === 0) return;
	event.preventDefault();
	target.scrollByKeyboard(delta);
}

function register(registration: Registration): () => void {
	registrations.add(registration);
	if (!removeKeyListener) {
		document.addEventListener('keydown', handleKeydown);
		removeKeyListener = () => document.removeEventListener('keydown', handleKeydown);
	}
	return () => {
		registrations.delete(registration);
		if (lastActive === registration) lastActive = null;
		if (registrations.size === 0 && removeKeyListener) {
			removeKeyListener();
			removeKeyListener = null;
		}
	};
}

function isNotchedWheel(event: WheelEvent): boolean {
	if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
	const legacy = event as WheelEvent & { wheelDeltaX?: number; wheelDeltaY?: number };
	const legacyDelta = legacy.wheelDeltaY || legacy.wheelDeltaX;
	return legacyDelta !== undefined && legacyDelta !== 0 && legacyDelta % notchDelta === 0;
}

export function createSmoothScroll(
	viewport: HTMLElement,
	content: HTMLElement,
	{ axis, isDisabled }: SmoothScrollOptions
) {
	let position = readOffset();
	let target = position;
	let written = position;
	let smoothingMs = wheelSmoothingMs;
	let frame = 0;
	let lastTime = 0;
	let lastWheelAt = -Infinity;

	function readOffset(): number {
		return axis === 'y' ? viewport.scrollTop : viewport.scrollLeft;
	}

	function writeOffset(offset: number) {
		if (axis === 'y') viewport.scrollTop = offset;
		else viewport.scrollLeft = offset;
	}

	function maxOffset(): number {
		return axis === 'y'
			? viewport.scrollHeight - viewport.clientHeight
			: viewport.scrollWidth - viewport.clientWidth;
	}

	function clamp(offset: number): number {
		return Math.min(Math.max(offset, 0), Math.max(maxOffset(), 0));
	}

	function setFraction(fraction: number) {
		if (Math.abs(fraction) < 0.01) {
			content.style.transform = '';
			return;
		}
		content.style.transform =
			axis === 'y' ? `translate3d(0, ${-fraction}px, 0)` : `translate3d(${-fraction}px, 0, 0)`;
	}

	function adoptExternalChange() {
		const actual = readOffset();
		if (actual === written) return;
		const shift = actual - written;
		position += shift;
		target += shift;
		written = actual;
	}

	function render() {
		position = clamp(position);
		writeOffset(Math.floor(position));
		written = readOffset();
		setFraction(position - written);
	}

	function finish() {
		cancelAnimationFrame(frame);
		frame = 0;
		lastTime = 0;
		writeOffset(clamp(Math.round(position)));
		syncAtRest();
		setFraction(0);
	}

	function tick(time: number) {
		if (isDisabled()) return finish();
		adoptExternalChange();
		const elapsed = Math.min(Math.max(time - lastTime, 0), longestFrameMs);
		lastTime = time;
		target = clamp(target);
		position += (target - position) * (1 - Math.exp(-elapsed / smoothingMs));
		if (Math.abs(target - position) < settleDistance) return finish();
		render();
		frame = requestAnimationFrame(tick);
	}

	function animating(): boolean {
		return frame !== 0;
	}

	function syncAtRest() {
		if (animating()) return;
		position = readOffset();
		target = position;
		written = position;
	}

	function startAnimation() {
		if (animating()) return;
		lastTime = performance.now();
		frame = requestAnimationFrame(tick);
	}

	function animateBy(delta: number, smoothing: number) {
		syncAtRest();
		target = clamp(target + delta);
		smoothingMs = smoothing;
		startAnimation();
	}

	function jumpTo(offset: number) {
		if (animating()) finish();
		writeOffset(clamp(offset));
		syncAtRest();
	}

	function scrollTo(offset: number, { instant = false }: { instant?: boolean } = {}) {
		if (instant || prefersReducedMotion.current) return jumpTo(offset);
		syncAtRest();
		target = clamp(offset);
		smoothingMs = wheelSmoothingMs;
		startAnimation();
	}

	function canMove(delta: number): boolean {
		const from = animating() ? target : readOffset();
		return delta < 0 ? from > 0 : from < maxOffset();
	}

	function wheelDelta(event: WheelEvent): number {
		const scale =
			event.deltaMode === WheelEvent.DOM_DELTA_LINE
				? lineDeltaPx
				: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
					? (axis === 'y' ? viewport.clientHeight : viewport.clientWidth) * pageFactor
					: 1;
		if (axis === 'y') return event.shiftKey ? 0 : event.deltaY * scale;
		return (event.deltaX !== 0 ? event.deltaX : event.deltaY) * scale;
	}

	function handleWheel(event: WheelEvent) {
		if (event.defaultPrevented || event.ctrlKey || isDisabled()) return;
		const delta = wheelDelta(event);
		if (delta === 0 || maxOffset() <= 0) return;
		const latched = event.timeStamp - lastWheelAt < wheelLatchMs;
		if (!canMove(delta)) {
			if (latched) {
				event.preventDefault();
				lastWheelAt = event.timeStamp;
			}
			return;
		}
		event.preventDefault();
		lastWheelAt = event.timeStamp;
		lastActive = registration;
		if (prefersReducedMotion.current) return jumpTo((animating() ? target : readOffset()) + delta);
		animateBy(delta, isNotchedWheel(event) ? wheelSmoothingMs : preciseSmoothingMs);
	}

	function handleScroll() {
		if (!animating()) syncAtRest();
	}

	function handlePointerDown() {
		lastActive = registration;
	}

	const registration: Registration = {
		viewport,
		axis,
		scrollByKeyboard: (delta) => {
			if (isDisabled()) return;
			lastActive = registration;
			if (prefersReducedMotion.current) return jumpTo(readOffset() + delta);
			animateBy(delta, wheelSmoothingMs);
		},
		scrollToEdge: (edge) => {
			if (isDisabled()) return;
			lastActive = registration;
			scrollTo(edge === 'start' ? 0 : maxOffset());
		}
	};

	const unregister = register(registration);
	viewport.addEventListener('wheel', handleWheel, { passive: false });
	viewport.addEventListener('scroll', handleScroll, { passive: true });
	viewport.addEventListener('pointerdown', handlePointerDown, { passive: true });

	return {
		get position() {
			return animating() ? position : readOffset();
		},
		scrollTo,
		stop: () => {
			if (animating()) finish();
		},
		destroy() {
			cancelAnimationFrame(frame);
			frame = 0;
			setFraction(0);
			unregister();
			viewport.removeEventListener('wheel', handleWheel);
			viewport.removeEventListener('scroll', handleScroll);
			viewport.removeEventListener('pointerdown', handlePointerDown);
		}
	};
}
