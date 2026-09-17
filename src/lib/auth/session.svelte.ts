import type { Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase/client';

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

export async function initSession(): Promise<void> {
	if (initialized) return;
	initialized = true;

	const { data } = await supabase.auth.getSession();
	session = data.session;

	supabase.auth.onAuthStateChange((_event, nextSession) => {
		session = nextSession;
	});
}
