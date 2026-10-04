import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerPresence, VoiceMember } from '$lib/presence/presence';
import type { MemberListPreview, MemberRow } from '$lib/servers/member-list.svelte';

const storage = vi.hoisted(() => ({
	disk: new Map<string, string>(),
	writes: [] as { section: string; bytes: number }[]
}));

vi.mock('$lib/history/history', () => ({
	history: {
		cacheGet: async (section: string) => storage.disk.get(section) ?? null,
		cachePut: async (section: string, value: string) => {
			storage.disk.set(section, value);
			storage.writes.push({ section, bytes: value.length });
		}
	}
}));

const userId = '00000000-0000-4000-8000-000000000001';
const start = new Date('2026-10-03T12:00:00Z').getTime();

async function freshModule() {
	vi.resetModules();
	return (await import('./workspace-cache')).workspaceCache;
}

function uuid(seed: number): string {
	return `00000000-0000-4000-8000-${seed.toString().padStart(12, '0')}`;
}

function row(seed: number): MemberRow {
	return {
		id: uuid(seed),
		username: `member_${seed}`,
		name: `Member ${seed}`,
		avatarId: uuid(seed + 1_000_000),
		status: seed % 3 === 0 ? 'online' : null
	};
}

function preview(server: number, rows = 100): MemberListPreview {
	return {
		counts: { online: rows / 3, offline: rows - rows / 3 },
		rows: Array.from({ length: rows }, (_, index) => row(server * 1000 + index))
	};
}

function voice(server: number): ServerPresence {
	const member = (index: number): VoiceMember =>
		({ userId: uuid(server * 1000 + index), micMuted: false, deafened: false }) as VoiceMember;
	return { voice: { [uuid(server)]: [member(1), member(2), member(3)] } } as ServerPresence;
}

async function savedSession(build: (cache: Awaited<ReturnType<typeof freshModule>>) => void) {
	const cache = await freshModule();
	await cache.read(userId);
	build(cache);
	cache.flush();
	await Promise.resolve();
}

async function reopen(afterMs: number) {
	vi.setSystemTime(Date.now() + afterMs);
	const cache = await freshModule();
	return { cache, snapshot: await cache.read(userId) };
}

describe('workspaceCache presence freshness', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(start);
		storage.disk.clear();
		storage.writes.length = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function seed(cache: Awaited<ReturnType<typeof freshModule>>, openServer = 1) {
		cache.saveFriendsOnline(userId, new Set([uuid(7), uuid(8)]));
		cache.savePresence(userId, uuid(openServer), voice(openServer));
		cache.saveMemberPreview(userId, uuid(openServer), preview(openServer, 5));
		cache.markPresenceLive(userId, uuid(openServer));
	}

	it('keeps presence after a quick restart', async () => {
		await savedSession((cache) => seed(cache));
		const { snapshot } = await reopen(60_000);
		expect([...snapshot.friendsOnline]).toEqual([uuid(7), uuid(8)]);
		expect(Object.keys(snapshot.presence)).toEqual([uuid(1)]);
		expect(snapshot.memberPreviews[uuid(1)]?.rows).toHaveLength(5);
	});

	it('drops presence after a break', async () => {
		await savedSession((cache) => seed(cache));
		const { snapshot } = await reopen(76_000);
		expect(snapshot.friendsOnline.size).toBe(0);
		expect(snapshot.presence).toEqual({});
		expect(snapshot.memberPreviews).toEqual({});
	});

	it('drops presence that was never marked live', async () => {
		await savedSession((cache) => {
			cache.saveFriendsOnline(userId, new Set([uuid(7)]));
			cache.saveMemberPreview(userId, uuid(1), preview(1, 5));
		});
		const { snapshot } = await reopen(1_000);
		expect(snapshot.friendsOnline.size).toBe(0);
		expect(snapshot.memberPreviews).toEqual({});
	});

	it('drops presence marked live in the future', async () => {
		await savedSession((cache) => seed(cache));
		const { snapshot } = await reopen(-5_000);
		expect(snapshot.friendsOnline.size).toBe(0);
	});

	it('keeps the rest of the cache when presence is dropped', async () => {
		await savedSession((cache) => {
			seed(cache);
			cache.saveAccount(userId, { username: 'me', servers: [], friends: [] });
		});
		const { snapshot } = await reopen(10 * 60_000);
		expect(snapshot.account?.username).toBe('me');
	});

	it('rewrites dropped presence on disk so a later live mark does not revive it', async () => {
		await savedSession((cache) => seed(cache));
		const { cache } = await reopen(10 * 60_000);
		cache.markPresenceLive(userId, null);
		vi.advanceTimersByTime(1_000);
		await Promise.resolve();
		const { snapshot } = await reopen(1_000);
		expect(snapshot.friendsOnline.size).toBe(0);
		expect(snapshot.presence).toEqual({});
		expect(snapshot.memberPreviews).toEqual({});
	});

	it('keeps only the preview of the server that stayed open', async () => {
		await savedSession((cache) => {
			cache.saveMemberPreview(userId, uuid(1), preview(1, 5));
			cache.saveMemberPreview(userId, uuid(2), preview(2, 5));
			vi.setSystemTime(Date.now() + 10 * 60_000);
			cache.markPresenceLive(userId, uuid(2));
		});
		const { snapshot } = await reopen(30_000);
		expect(Object.keys(snapshot.memberPreviews)).toEqual([uuid(2)]);
	});

	it('a fresh preview survives without being open at the end', async () => {
		await savedSession((cache) => {
			cache.saveMemberPreview(userId, uuid(1), preview(1, 5));
			cache.markPresenceLive(userId, null);
		});
		const { snapshot } = await reopen(30_000);
		expect(Object.keys(snapshot.memberPreviews)).toEqual([uuid(1)]);
	});

	it('returns previews without bookkeeping fields', async () => {
		await savedSession((cache) => seed(cache));
		const { snapshot } = await reopen(1_000);
		expect(Object.keys(snapshot.memberPreviews[uuid(1)])).toEqual(['counts', 'rows']);
	});
});

describe('workspaceCache presence stamp load', () => {
	const servers = 30;
	const stampsPerHour = 120;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		vi.setSystemTime(start);
		storage.disk.clear();
		storage.writes.length = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('an hour of live stamps on a large cache writes only tiny sections', async () => {
		const cache = await freshModule();
		await cache.read(userId);
		cache.saveFriendsOnline(userId, new Set(Array.from({ length: 200 }, (_, index) => uuid(index))));
		for (let server = 1; server <= servers; server++) {
			cache.savePresence(userId, uuid(server), voice(server));
			cache.saveMemberPreview(userId, uuid(server), preview(server));
		}
		cache.flush();
		await Promise.resolve();
		const previewsBytes = storage.writes.find((write) => write.section === 'memberPreviews')!.bytes;
		storage.writes.length = 0;

		const started = performance.now();
		for (let stamp = 0; stamp < stampsPerHour; stamp++) {
			vi.advanceTimersByTime(30_000);
			cache.markPresenceLive(userId, uuid(1 + (stamp % servers)));
		}
		vi.advanceTimersByTime(1_000);
		await Promise.resolve();
		const elapsedMs = performance.now() - started;

		const bytesBySection = new Map<string, number>();
		for (const write of storage.writes) {
			bytesBySection.set(write.section, (bytesBySection.get(write.section) ?? 0) + write.bytes);
		}
		const totalBytes = [...bytesBySection.values()].reduce((sum, bytes) => sum + bytes, 0);
		console.log(
			`[load] previews section ${(previewsBytes / 1024).toFixed(1)} KB; per hour: ` +
				`${storage.writes.length} writes, ${(totalBytes / 1024).toFixed(1)} KB ` +
				`(${[...bytesBySection].map(([section, bytes]) => `${section} ${(bytes / 1024).toFixed(1)} KB`).join(', ')}); ` +
				`${elapsedMs.toFixed(1)} ms of JS`
		);

		expect(bytesBySection.get('memberPreviews') ?? 0).toBe(0);
		expect(totalBytes).toBeLessThan(stampsPerHour * 2 * 1024);
		expect(elapsedMs).toBeLessThan(250);
	});
});
