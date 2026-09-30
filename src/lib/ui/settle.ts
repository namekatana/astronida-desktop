export function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
	return {
		duration,
		css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
	};
}
