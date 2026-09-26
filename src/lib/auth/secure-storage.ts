import { invoke } from '@tauri-apps/api/core';

interface AuthStorage {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
}

function isTauri() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function moveFromLocalStorage(key: string): Promise<string | null> {
	const legacy = localStorage.getItem(key);
	if (legacy === null) return null;
	await invoke('secure_store_set', { key, value: legacy });
	localStorage.removeItem(key);
	return legacy;
}

const tauriStorage: AuthStorage = {
	async getItem(key) {
		try {
			const stored = await invoke<string | null>('secure_store_get', { key });
			return stored ?? (await moveFromLocalStorage(key));
		} catch {
			return null;
		}
	},

	setItem(key, value) {
		return invoke('secure_store_set', { key, value });
	},

	removeItem(key) {
		localStorage.removeItem(key);
		return invoke('secure_store_remove', { key });
	}
};

const browserStorage: AuthStorage = {
	async getItem(key) {
		return localStorage.getItem(key);
	},

	async setItem(key, value) {
		localStorage.setItem(key, value);
	},

	async removeItem(key) {
		localStorage.removeItem(key);
	}
};

export const secureStorage: AuthStorage = isTauri() ? tauriStorage : browserStorage;
