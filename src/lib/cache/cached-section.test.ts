import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ writes: [] as { section: string; value: string }[] }));

vi.mock('$lib/history/history', () => ({
	history: {
		cacheGet: async () => null,
		cachePut: async (section: string, value: string) => {
			storage.writes.push({ section, value });
		}
	}
}));

import { createCachedSection } from './cached-section';

describe('createCachedSection', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		storage.writes.length = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('writes once a second after the first change, with the latest snapshot', () => {
		const section = createCachedSection('friendsOnline');
		section.persist(() => ['a']);
		section.persist(() => ['a', 'b']);
		vi.advanceTimersByTime(999);
		expect(storage.writes).toHaveLength(0);
		vi.advanceTimersByTime(1);
		expect(storage.writes).toEqual([{ section: 'friendsOnline', value: '["a","b"]' }]);
	});

	it('does not postpone the write while changes keep coming', () => {
		const section = createCachedSection('presence');
		for (let tick = 0; tick < 10; tick++) {
			section.persist(() => tick);
			vi.advanceTimersByTime(200);
		}
		expect(storage.writes.map((write) => write.value)).toEqual(['4', '9']);
	});

	it('flush writes a pending change immediately and only once', () => {
		const section = createCachedSection('presenceLiveAt');
		section.persist(() => 42);
		section.flush();
		expect(storage.writes).toEqual([{ section: 'presenceLiveAt', value: '42' }]);
		vi.advanceTimersByTime(2000);
		expect(storage.writes).toHaveLength(1);
	});

	it('flush without a pending change writes nothing', () => {
		createCachedSection('account').flush();
		expect(storage.writes).toHaveLength(0);
	});

	it('cancel drops a pending change', () => {
		const section = createCachedSection('account');
		section.persist(() => 1);
		section.cancel();
		vi.advanceTimersByTime(2000);
		expect(storage.writes).toHaveLength(0);
	});
});
