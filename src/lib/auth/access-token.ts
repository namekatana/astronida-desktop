import { untrack } from 'svelte';
import { supabase } from '$lib/supabase/client';
import { auth } from './session.svelte';

const refreshMarginMs = 60_000;

function expiresSoon(expiresAt: number | undefined): boolean {
	if (expiresAt === undefined) return true;
	return expiresAt * 1000 - Date.now() < refreshMarginMs;
}

export async function accessToken(): Promise<string | null> {
	const session = untrack(() => auth.session);
	if (!session) return null;
	if (!expiresSoon(session.expires_at)) return session.access_token;
	const { data } = await supabase.auth.getSession();
	return data.session?.access_token ?? null;
}
