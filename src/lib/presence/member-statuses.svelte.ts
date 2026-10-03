import { SvelteMap } from 'svelte/reactivity';
import type { PresenceStatus } from './status';

const statuses = new SvelteMap<string, PresenceStatus | null>();

export const memberStatuses = {
	has(userId: string): boolean {
		return statuses.has(userId);
	},
	of(userId: string): PresenceStatus | null {
		return statuses.get(userId) ?? null;
	},
	learn(userId: string, status: PresenceStatus | null) {
		if (statuses.get(userId) === status && statuses.has(userId)) return;
		statuses.set(userId, status);
	},
	clear() {
		statuses.clear();
	}
};
