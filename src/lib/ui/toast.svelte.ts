const visibleMs = 1800;

let current = $state<{ text: string; version: number } | null>(null);
let version = 0;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const toast = {
	get current() {
		return current;
	},
	show(text: string) {
		clearTimeout(hideTimer);
		version += 1;
		current = { text, version };
		hideTimer = setTimeout(() => (current = null), visibleMs);
	}
};
