import { SvelteSet } from 'svelte/reactivity';

export type ScreenPoint = { x: number; y: number };

const revealed = new SvelteSet<string>();
const origins = new Map<string, ScreenPoint | null>();

export const spoilers = {
	isRevealed(messageId: string): boolean {
		return revealed.has(messageId);
	},
	originOf(messageId: string): ScreenPoint | null {
		return origins.get(messageId) ?? null;
	},
	reveal(messageId: string, origin: ScreenPoint | null) {
		if (revealed.has(messageId)) return;
		origins.set(messageId, origin);
		revealed.add(messageId);
	},
	carryOver(pendingId: string, messageId: string) {
		if (!revealed.has(pendingId)) return;
		revealed.delete(pendingId);
		origins.delete(pendingId);
		revealed.add(messageId);
	}
};
