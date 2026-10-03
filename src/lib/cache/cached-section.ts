import { history } from '$lib/history/history';

const persistDelayMs = 1000;

export function createCachedSection(section: string) {
	let persistTimer: ReturnType<typeof setTimeout> | null = null;
	let latest: (() => unknown) | null = null;

	function cancel() {
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = null;
		latest = null;
	}

	function write() {
		persistTimer = null;
		const snapshot = latest;
		latest = null;
		if (snapshot) void history.cachePut(section, JSON.stringify(snapshot())).catch(() => {});
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
			latest = snapshot;
			persistTimer ??= setTimeout(write, persistDelayMs);
		},

		cancel
	};
}
