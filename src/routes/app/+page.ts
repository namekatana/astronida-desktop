import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';
import { workspaceCache, type CachedAccount } from '$lib/cache/workspace-cache';
import { loadFriends } from '$lib/friends/friends';
import { history } from '$lib/history/history';
import { loadServers } from '$lib/servers/servers';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

async function fetchAccount(userId: string): Promise<CachedAccount> {
	const [profile, servers, friends] = await Promise.all([
		retryOnFreshToken(() =>
			supabase.from('profiles').select('username').eq('id', userId).single()
		),
		loadServers(),
		loadFriends(userId)
	]);
	const account = { username: profile.data?.username ?? null, servers, friends };
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
	await history.open(user.id).catch(() => {});
	const account = cache.account ?? (await refresh);

	return { userId: user.id, account, refresh, cache };
}
