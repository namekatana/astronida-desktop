import { on } from 'svelte/events';

export function dismissOn(root: HTMLElement, close: () => void): () => void {
	const offPointer = on(document, 'pointerdown', (event) => {
		if (!root.contains(event.target as Node)) close();
	});
	const offKey = on(document, 'keydown', (event) => {
		if (event.key === 'Escape') close();
	});
	return () => {
		offPointer();
		offKey();
	};
}
