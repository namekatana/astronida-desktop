import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';

export interface AvailableUpdate {
	version: string;
	date: string | null;
	notes: string | null;
}

const firstCheckDelayMs = 15_000;
const checkIntervalMs = 6 * 60 * 60 * 1000;

let available = $state<AvailableUpdate | null>(null);
let installing = $state(false);
let progress = $state(0);
let error = $state<string | null>(null);

let pending: Update | null = null;
let scheduled = false;

function isTauri() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function checkNow() {
	if (!isTauri() || installing) return;
	try {
		const update = await check();
		if (!update) return;
		pending = update;
		available = {
			version: update.version,
			date: update.date ?? null,
			notes: update.body ?? null
		};
	} catch {
	}
}

export const updates = {
	get available() {
		return available;
	},
	get installing() {
		return installing;
	},
	get progress() {
		return progress;
	},
	get error() {
		return error;
	},

	schedule() {
		if (scheduled || !isTauri()) return;
		scheduled = true;
		setTimeout(() => void checkNow(), firstCheckDelayMs);
		setInterval(() => void checkNow(), checkIntervalMs);
	},

	async install() {
		const update = pending;
		if (!update || installing) return;
		installing = true;
		error = null;
		progress = 0;
		let total = 0;
		let received = 0;
		try {
			await update.downloadAndInstall((event) => {
				if (event.event === 'Started') total = event.data.contentLength ?? 0;
				if (event.event === 'Progress') {
					received += event.data.chunkLength;
					if (total > 0) progress = Math.min(100, Math.round((received / total) * 100));
				}
				if (event.event === 'Finished') progress = 100;
			});
			await relaunch();
		} catch {
			error = 'Не удалось установить обновление';
			installing = false;
		}
	}
};
