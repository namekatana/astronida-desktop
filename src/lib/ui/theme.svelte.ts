import { prefersReducedMotion } from 'svelte/motion';

export type ThemeId = 'cosmos' | 'rose';
export type ThemeScope = 'auth' | 'app';

export interface ThemeOption {
	id: ThemeId;
	label: string;
	description: string;
}

export const themeOptions: ThemeOption[] = [
	{ id: 'cosmos', label: 'Космос', description: 'Тёмная, монохромная' },
	{ id: 'rose', label: 'Матовая роза', description: 'Тёмная, пыльно-розовая' }
];

const storageKey = 'astronida.theme';
const defaultTheme: ThemeId = 'cosmos';

let current = $state<ThemeId>(defaultTheme);
let scope: ThemeScope = 'auth';

function isThemeId(value: string | null): value is ThemeId {
	return themeOptions.some((option) => option.id === value);
}

function storedTheme(): ThemeId {
	try {
		const stored = localStorage.getItem(storageKey);
		return isThemeId(stored) ? stored : defaultTheme;
	} catch {
		return defaultTheme;
	}
}

function storeTheme(id: ThemeId) {
	try {
		localStorage.setItem(storageKey, id);
	} catch {}
}

function shownTheme(): ThemeId {
	return scope === 'app' ? current : defaultTheme;
}

function applyTheme() {
	document.documentElement.dataset.theme = shownTheme();
}

function switchSmoothly() {
	if (prefersReducedMotion.current || !document.startViewTransition) {
		applyTheme();
		return;
	}
	document.startViewTransition(applyTheme);
}

export const theme = {
	get current() {
		return current;
	},
	restore() {
		current = storedTheme();
		applyTheme();
	},
	enter(next: ThemeScope) {
		scope = next;
		applyTheme();
	},
	choose(id: ThemeId) {
		if (id === current) return;
		current = id;
		storeTheme(id);
		switchSmoothly();
	}
};
