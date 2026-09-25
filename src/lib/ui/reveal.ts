import { quintOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import { slide, type TransitionConfig } from 'svelte/transition';

interface RevealParams {
	duration?: number;
}

export function reveal(node: Element, { duration = 260 }: RevealParams = {}): TransitionConfig {
	if (prefersReducedMotion.current) {
		return { duration: Math.min(duration, 180), css: (t) => `opacity: ${t}` };
	}
	const base = slide(node, { duration, easing: quintOut });
	return { ...base, css: (t, u) => `${base.css?.(t, u) ?? ''}; opacity: ${t}` };
}
