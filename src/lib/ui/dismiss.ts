import { on } from 'svelte/events';

export function dismissOn(root: HTMLElement, close: (target: Node | null) => void): () => void {
	const offPointer = on(document, 'pointerdown', (event) => {
		const target = event.target as Node;
		if (!root.contains(target)) close(target);
	});
	const offKey = on(document, 'keydown', (event) => {
		if (event.key === 'Escape') close(null);
	});
	return () => {
		offPointer();
		offKey();
	};
}
