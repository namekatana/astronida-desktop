import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

interface PopParams {
	y?: number;
	duration?: number;
}

const startScale = 0.97;

export function pop(_node: Element, { y = 0, duration = 200 }: PopParams = {}): TransitionConfig {
	if (prefersReducedMotion.current) {
		return { duration, easing: cubicOut, css: (t) => `opacity: ${t}` };
	}
	return {
		duration,
		easing: cubicOut,
		css: (t, u) =>
			`opacity: ${t}; transform: translateY(${u * y}px) scale(${startScale + (1 - startScale) * t})`
	};
}
