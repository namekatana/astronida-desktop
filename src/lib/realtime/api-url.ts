import { PUBLIC_PHOENIX_URL } from '$env/static/public';

const apiBase = PUBLIC_PHOENIX_URL.replace(/^ws/, 'http').replace(/\/socket$/, '/api');

export function apiUrl(path: string): string {
	return `${apiBase}${path}`;
}
