import type { Channel as PhoenixChannel } from 'phoenix';
import { memberStatuses } from '$lib/presence/member-statuses.svelte';
import { presenceStatusFrom, type PresenceStatus } from '$lib/presence/status';
import { knownAvatars } from '$lib/profile/known-avatars.svelte';
import { phoenixSocket } from '$lib/realtime/socket';

export interface MemberRow {
	id: string;
	username: string;
	name: string;
	avatarId: string | null;
	status: PresenceStatus | null;
}

export interface MemberCounts {
	online: number;
	offline: number | null;
}

export interface MemberListPreview {
	counts: MemberCounts;
	rows: MemberRow[];
}

interface Delta {
	base: number;
	version: number;
	counts: MemberCounts | null;
	ops: unknown[];
}

interface WindowSubscription {
	channel: PhoenixChannel;
	version: number | null;
	pending: Delta[];
	releaseTimer: ReturnType<typeof setTimeout> | null;
}

export const memberWindowSize = 100;
const maxWindows = 3;
const releaseAfterMs = 2_000;
const pendingLimit = 50;

function rowFrom(value: unknown): MemberRow | null {
	if (!Array.isArray(value) || value.length < 5) return null;
	const [id, username, name, avatarId, status] = value;
	if (typeof id !== 'string' || typeof username !== 'string' || typeof name !== 'string') {
		return null;
	}
	return {
		id,
		username,
		name,
		avatarId: typeof avatarId === 'string' ? avatarId : null,
		status: typeof status === 'string' ? presenceStatusFrom(status) : null
	};
}

function rowsFrom(value: unknown): MemberRow[] | null {
	if (!Array.isArray(value)) return null;
	const rows = value.map(rowFrom);
	return rows.every((row): row is MemberRow => row !== null) ? rows : null;
}

function countsFrom(value: unknown): MemberCounts | null {
	const record = value as { online?: unknown; offline?: unknown } | null;
	if (!record || typeof record.online !== 'number') return null;
	const offline = typeof record.offline === 'number' ? record.offline : null;
	return { online: record.online, offline };
}

function applyOps(rows: MemberRow[], ops: unknown[]): MemberRow[] | null {
	const result: MemberRow[] = [];
	let cursor = 0;
	for (const op of ops) {
		if (!Array.isArray(op)) return null;
		const [kind, value] = op;
		if (kind === 'k' && typeof value === 'number') {
			if (cursor + value > rows.length) return null;
			result.push(...rows.slice(cursor, cursor + value));
			cursor += value;
		} else if (kind === 'd' && typeof value === 'number') {
			cursor += value;
		} else if (kind === 'i') {
			const inserted = rowsFrom(value);
			if (!inserted) return null;
			result.push(...inserted);
		} else {
			return null;
		}
	}
	if (cursor > rows.length) return null;
	return [...result, ...rows.slice(cursor)];
}

function learn(rows: MemberRow[]) {
	for (const row of rows) {
		knownAvatars.learn(row.id, row.avatarId);
		memberStatuses.learn(row.id, row.status);
	}
}

function nearestStarts(first: number, last: number, total: number): number[] {
	const lastStart = Math.max(0, Math.floor(Math.max(total - 1, 0) / memberWindowSize));
	const from = Math.max(0, Math.floor(first / memberWindowSize) - 1);
	const to = Math.min(lastStart, Math.floor(last / memberWindowSize) + 1);
	const center = (first + last) / 2 / memberWindowSize;
	const indexes: number[] = [];
	for (let index = from; index <= to; index++) indexes.push(index);
	return indexes
		.sort((a, b) => Math.abs(a + 0.5 - center) - Math.abs(b + 0.5 - center))
		.slice(0, maxWindows)
		.map((index) => index * memberWindowSize);
}

export function createMemberList(input: {
	serverId: string;
	preview: MemberListPreview | null;
	onPreview: (preview: MemberListPreview) => void;
}) {
	let counts = $state<MemberCounts>(input.preview?.counts ?? { online: 0, offline: null });
	let loaded = $state(input.preview !== null);
	const windows = $state<Record<number, MemberRow[]>>(
		input.preview ? { 0: input.preview.rows } : {}
	);
	const subscriptions = new Map<number, WindowSubscription>();
	let destroyed = false;

	function publishPreview() {
		const rows = windows[0];
		if (rows) input.onPreview({ counts, rows: $state.snapshot(rows) });
	}

	function adopt(start: number, rows: MemberRow[], next: MemberCounts | null) {
		windows[start] = rows;
		if (next) counts = next;
		loaded = true;
		learn(rows);
		if (start === 0) publishPreview();
	}

	function resync(subscription: WindowSubscription) {
		subscription.version = null;
		subscription.pending = [];
		subscription.channel.push('resync', {});
	}

	function applyDelta(start: number, subscription: WindowSubscription, delta: Delta) {
		if (subscription.version === null) return;
		if (delta.base < subscription.version) return;
		if (delta.base > subscription.version) {
			resync(subscription);
			return;
		}
		const next = applyOps(windows[start] ?? [], delta.ops);
		if (!next) {
			resync(subscription);
			return;
		}
		subscription.version = delta.version;
		adopt(start, next, delta.counts);
	}

	function handleSync(start: number, subscription: WindowSubscription, payload: unknown) {
		const record = payload as { version?: unknown; counts?: unknown; rows?: unknown } | null;
		const rows = rowsFrom(record?.rows);
		if (!rows || typeof record?.version !== 'number') return;
		subscription.version = record.version;
		adopt(start, rows, countsFrom(record.counts));
		const waiting = subscription.pending;
		subscription.pending = [];
		for (const delta of waiting) applyDelta(start, subscription, delta);
	}

	function handleDelta(start: number, subscription: WindowSubscription, payload: unknown) {
		const record = payload as {
			base?: unknown;
			version?: unknown;
			counts?: unknown;
			ops?: unknown;
		} | null;
		if (typeof record?.base !== 'number' || typeof record.version !== 'number') return;
		if (!Array.isArray(record.ops)) return;
		const delta = {
			base: record.base,
			version: record.version,
			counts: countsFrom(record.counts),
			ops: record.ops
		};
		if (subscription.version === null) {
			if (subscription.pending.length < pendingLimit) subscription.pending.push(delta);
			return;
		}
		applyDelta(start, subscription, delta);
	}

	function join(start: number) {
		const channel = phoenixSocket().channel(`member_list:${input.serverId}:${start}`);
		const subscription: WindowSubscription = {
			channel,
			version: null,
			pending: [],
			releaseTimer: null
		};
		channel.on('member_list_sync', (payload) => handleSync(start, subscription, payload));
		channel.on('member_list_delta', (payload) => handleDelta(start, subscription, payload));
		channel.onError(() => {
			subscription.version = null;
			subscription.pending = [];
		});
		channel.join();
		subscriptions.set(start, subscription);
	}

	function release(start: number) {
		const subscription = subscriptions.get(start);
		if (!subscription) return;
		if (subscription.releaseTimer) clearTimeout(subscription.releaseTimer);
		subscription.channel.leave();
		subscriptions.delete(start);
		if (start !== 0) delete windows[start];
	}

	function setViewport(first: number, last: number) {
		if (destroyed) return;
		const total = counts.online + (counts.offline ?? 0);
		const wanted = new Set(nearestStarts(first, last, total));
		for (const start of wanted) {
			const existing = subscriptions.get(start);
			if (!existing) {
				join(start);
			} else if (existing.releaseTimer) {
				clearTimeout(existing.releaseTimer);
				existing.releaseTimer = null;
			}
		}
		for (const [start, subscription] of subscriptions) {
			if (wanted.has(start) || subscription.releaseTimer) continue;
			subscription.releaseTimer = setTimeout(() => release(start), releaseAfterMs);
		}
	}

	function rowAt(index: number): MemberRow | null {
		const start = Math.floor(index / memberWindowSize) * memberWindowSize;
		return windows[start]?.[index - start] ?? null;
	}

	function destroy() {
		destroyed = true;
		for (const start of [...subscriptions.keys()]) release(start);
	}

	return {
		get counts() {
			return counts;
		},
		get loaded() {
			return loaded;
		},
		rowAt,
		setViewport,
		destroy
	};
}
