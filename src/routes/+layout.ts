import { browser } from '$app/environment';
import { initSession } from '$lib/auth/session.svelte';

export const ssr = false;
export const prerender = true;

export async function load() {
	if (browser) {
		await initSession();
	}
}
