const storageKey = 'astronida.panel-widths';

export const panelLimits = { min: 200, max: 360 } as const;

interface PanelWidths {
	channels: number;
	members: number;
}

const defaults: PanelWidths = { channels: 260, members: 240 };

function clamp(value: number): number {
	return Math.min(panelLimits.max, Math.max(panelLimits.min, Math.round(value)));
}

function restore(): PanelWidths {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return defaults;
		const parsed = JSON.parse(raw) as Partial<PanelWidths>;
		return {
			channels: clamp(parsed.channels ?? defaults.channels),
			members: clamp(parsed.members ?? defaults.members)
		};
	} catch {
		return defaults;
	}
}

function persist(widths: PanelWidths) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(widths));
	} catch {
	}
}

let widths = $state<PanelWidths>(restore());

export const panelWidths = {
	get channels() {
		return widths.channels;
	},
	set channels(value: number) {
		widths.channels = clamp(value);
		persist(widths);
	},
	get members() {
		return widths.members;
	},
	set members(value: number) {
		widths.members = clamp(value);
		persist(widths);
	}
};
