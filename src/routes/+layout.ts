import { browser } from '$app/environment';
import { initSession } from '$lib/auth/session.svelte';
import { theme } from '$lib/ui/theme.svelte';

export const ssr = false;
export const prerender = true;

export async function load() {
	if (browser) {
		theme.restore();
		await initSession();
	}
}
