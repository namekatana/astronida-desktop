import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';

export async function load({ parent }) {
	await parent();
	if (auth.user) {
		redirect(307, '/app');
	}
}
