export const skeletonDelayMs = 300;

export function createDelayedFlag(source: () => boolean, delayMs = skeletonDelayMs) {
	let raised = $state(false);

	$effect(() => {
		if (!source()) {
			raised = false;
			return;
		}
		const timer = setTimeout(() => (raised = true), delayMs);
		return () => clearTimeout(timer);
	});

	return {
		get current() {
			return raised && source();
		}
	};
}
