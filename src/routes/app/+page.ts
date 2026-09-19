import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';
import { workspaceCache, type CachedAccount } from '$lib/cache/workspace-cache';
import { loadServers } from '$lib/servers/servers';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

async function fetchAccount(userId: string): Promise<CachedAccount> {
	const [profile, servers] = await Promise.all([
		retryOnFreshToken(() =>
			supabase.from('profiles').select('username').eq('id', userId).single()
		),
		loadServers()
	]);
	const account = { username: profile.data?.username ?? null, servers };
	workspaceCache.saveAccount(userId, account);
	return account;
}

export async function load() {
	const user = auth.user;
	if (!user) {
		redirect(307, '/');
	}

	const cache = workspaceCache.read(user.id);
	const refresh = fetchAccount(user.id);
	const account = cache.account ?? (await refresh);

	return { userId: user.id, account, refresh, cache };
}
