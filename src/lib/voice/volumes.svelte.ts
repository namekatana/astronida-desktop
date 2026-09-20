const storageKey = 'astronida.voice.volumes';
export const defaultVolume = 1;
export const maxVolume = 2;

interface ParticipantAudio {
	volume: number;
	muted: boolean;
}

function load(): Record<string, ParticipantAudio> {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		const result: Record<string, ParticipantAudio> = {};
		for (const [userId, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (!value || typeof value !== 'object') continue;
			const { volume, muted } = value as { volume?: unknown; muted?: unknown };
			result[userId] = {
				volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : defaultVolume,
				muted: muted === true
			};
		}
		return result;
	} catch {
		return {};
	}
}

let settings = $state<Record<string, ParticipantAudio>>(load());

function persist() {
	try {
		localStorage.setItem(storageKey, JSON.stringify(settings));
	} catch {
	}
}

export function clampVolume(value: number): number {
	return Math.min(maxVolume, Math.max(0, value));
}

function update(userId: string, patch: Partial<ParticipantAudio>) {
	const current = settings[userId] ?? { volume: defaultVolume, muted: false };
	const next = { ...current, ...patch };
	if (next.volume === defaultVolume && !next.muted) delete settings[userId];
	else settings[userId] = next;
	persist();
}

export const participantAudio = {
	volume(userId: string): number {
		return settings[userId]?.volume ?? defaultVolume;
	},
	muted(userId: string): boolean {
		return settings[userId]?.muted ?? false;
	},
	effective(userId: string): number {
		return this.muted(userId) ? 0 : this.volume(userId);
	},
	setVolume(userId: string, value: number) {
		update(userId, { volume: clampVolume(value) });
	},
	setMuted(userId: string, muted: boolean) {
		update(userId, { muted });
	}
};
