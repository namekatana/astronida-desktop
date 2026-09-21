import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { authStorageKey, supabase } from '$lib/supabase/client';

const offlineStartTimeoutMs = 3000;
const stillLoading = Symbol('stillLoading');

let session = $state<Session | null>(null);
let initialized = false;

export const auth = {
	get session() {
		return session;
	},
	get user() {
		return session?.user ?? null;
	}
};

function storedSession(): Session | null {
	try {
		const raw = localStorage.getItem(authStorageKey);
		if (!raw) return null;
		const candidate = JSON.parse(raw) as Partial<Session>;
		const usable =
			typeof candidate.access_token === 'string' && typeof candidate.user?.id === 'string';
		return usable ? (candidate as Session) : null;
	} catch {
		return null;
	}
}

async function loadSession(): Promise<Session | null> {
	const { data, error } = await supabase.auth.getSession();
	if (data.session) return data.session;
	return error && isAuthRetryableFetchError(error) ? storedSession() : null;
}

function afterTimeout(): Promise<typeof stillLoading> {
	return new Promise((resolve) => setTimeout(() => resolve(stillLoading), offlineStartTimeoutMs));
}

export async function initSession(): Promise<void> {
	if (initialized) return;
	initialized = true;

	supabase.auth.onAuthStateChange((event, nextSession) => {
		if (event === 'INITIAL_SESSION') return;
		session = nextSession;
	});

	const loading = loadSession();
	const first = await Promise.race([loading, afterTimeout()]);
	if (first !== stillLoading) {
		session = first;
		return;
	}
	session = storedSession();
	void loading.then((loaded) => {
		if (loaded) session = loaded;
	});
}
