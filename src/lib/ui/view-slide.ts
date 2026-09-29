import { cubicIn, cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';

export const viewShift = 24;

export function viewIn(_node: Element, { from }: { from: number }) {
	if (prefersReducedMotion.current) {
		return { duration: 180, css: (t: number) => `opacity: ${t}` };
	}
	return {
		delay: 60,
		duration: 260,
		easing: cubicOut,
		css: (t: number, u: number) => `opacity: ${t}; transform: translateX(${u * from}px)`
	};
}

export function viewOut(_node: Element, { to }: { to: number }) {
	if (prefersReducedMotion.current) {
		return { duration: 120, css: (t: number) => `opacity: ${t}` };
	}
	return {
		duration: 180,
		easing: cubicIn,
		css: (t: number, u: number) => `opacity: ${t}; transform: translateX(${u * to}px)`
	};
}
