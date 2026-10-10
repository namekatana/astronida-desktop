import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	session: null as { access_token: string; expires_at?: number } | null,
	getSession: vi.fn()
}));

vi.mock('$lib/auth/session.svelte', () => ({
	auth: {
		get session() {
			return state.session;
		}
	}
}));

vi.mock('$lib/supabase/client', () => ({
	supabase: { auth: { getSession: state.getSession } }
}));

const { accessToken } = await import('./access-token');

const now = new Date('2026-10-10T12:00:00Z');
const nowSeconds = now.getTime() / 1000;

describe('accessToken', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		state.getSession.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		state.session = null;
	});

	it('returns the cached token without asking Supabase while it is fresh', async () => {
		state.session = { access_token: 'cached', expires_at: nowSeconds + 600 };

		expect(await accessToken()).toBe('cached');
		expect(state.getSession).not.toHaveBeenCalled();
	});

	it('refreshes a token that expires within a minute', async () => {
		state.session = { access_token: 'stale', expires_at: nowSeconds + 30 };
		state.getSession.mockResolvedValue({ data: { session: { access_token: 'fresh' } } });

		expect(await accessToken()).toBe('fresh');
		expect(state.getSession).toHaveBeenCalledTimes(1);
	});

	it('refreshes a token that has already expired', async () => {
		state.session = { access_token: 'expired', expires_at: nowSeconds - 3600 };
		state.getSession.mockResolvedValue({ data: { session: { access_token: 'fresh' } } });

		expect(await accessToken()).toBe('fresh');
	});

	it('returns null when the refresh loses the session', async () => {
		state.session = { access_token: 'expired', expires_at: nowSeconds - 3600 };
		state.getSession.mockResolvedValue({ data: { session: null } });

		expect(await accessToken()).toBeNull();
	});

	it('returns null without a session', async () => {
		expect(await accessToken()).toBeNull();
		expect(state.getSession).not.toHaveBeenCalled();
	});
});
