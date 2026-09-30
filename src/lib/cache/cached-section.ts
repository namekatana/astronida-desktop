import { history } from '$lib/history/history';

const persistDelayMs = 300;

export function createCachedSection(section: string) {
	let persistTimer: ReturnType<typeof setTimeout> | null = null;

	function cancel() {
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = null;
	}

	return {
		async read(): Promise<unknown> {
			const raw = await history.cacheGet(section).catch(() => null);
			if (!raw) return null;
			try {
				return JSON.parse(raw) as unknown;
			} catch {
				return null;
			}
		},

		persist(snapshot: () => unknown) {
			cancel();
			persistTimer = setTimeout(() => {
				persistTimer = null;
				void history.cachePut(section, JSON.stringify(snapshot())).catch(() => {});
			}, persistDelayMs);
		},

		cancel
	};
}
