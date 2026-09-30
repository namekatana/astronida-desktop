import { quintOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

interface MaterializeParams {
	y?: number;
	scale?: number;
	blur?: number;
	duration?: number;
	easing?: (t: number) => number;
}

export function materialize(
	_node: Element,
	{ y = 0, scale = 1, blur = 0, duration = 280, easing = quintOut }: MaterializeParams = {}
): TransitionConfig {
	if (prefersReducedMotion.current) {
		return { duration: Math.min(duration, 150), css: (t) => `opacity: ${t}` };
	}
	return {
		duration,
		easing,
		css: (t, u) =>
			`opacity: ${t}; transform: translateY(${u * y}px) scale(${1 + (scale - 1) * u}); filter: blur(${u * blur}px)`
	};
}
