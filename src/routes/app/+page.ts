import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';
import { loadServers } from '$lib/servers/servers';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export async function load() {
	const user = auth.user;
	if (!user) {
		redirect(307, '/');
	}

	const [profile, servers] = await Promise.all([
		retryOnFreshToken(() =>
			supabase.from('profiles').select('username').eq('id', user.id).single()
		),
		loadServers()
	]);

	return { userId: user.id, username: profile.data?.username ?? null, servers };
}
