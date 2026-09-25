import { getCurrentWindow } from '@tauri-apps/api/window';

function inTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function documentVisible(): boolean {
	return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function documentFocused(): boolean {
	return typeof document === 'undefined' || document.hasFocus();
}

let focused = $state(documentFocused());
let visible = $state(documentVisible());

if (typeof window !== 'undefined') {
	document.addEventListener('visibilitychange', () => (visible = documentVisible()));

	if (inTauri()) {
		void getCurrentWindow().onFocusChanged(({ payload }) => (focused = payload));
	} else {
		window.addEventListener('focus', () => (focused = documentFocused()));
		window.addEventListener('blur', () => (focused = documentFocused()));
	}
}

export const windowFocus = {
	get active() {
		return focused && visible;
	}
};
