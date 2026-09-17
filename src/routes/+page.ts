import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';

export function load() {
	if (auth.user) {
		redirect(307, '/app');
	}
}
