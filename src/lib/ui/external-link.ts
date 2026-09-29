import { openUrl } from '@tauri-apps/plugin-opener';

function inTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function openExternal(href: string) {
	const protocol = new URL(href).protocol;
	if (protocol !== 'https:' && protocol !== 'http:') return;
	if (inTauri()) {
		void openUrl(href).catch(() => {});
		return;
	}
	window.open(href, '_blank', 'noopener,noreferrer');
}
