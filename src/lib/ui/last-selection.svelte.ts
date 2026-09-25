import { untrack } from 'svelte';

const storageKey = 'astronida.last-selection';

interface LastSelection {
	serverId: string | null;
	channelByServer: Record<string, string>;
	friendId: string | null;
}

const defaults: LastSelection = { serverId: null, channelByServer: {}, friendId: null };

function restore(): LastSelection {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return defaults;
		const parsed = JSON.parse(raw) as Partial<LastSelection>;
		return {
			serverId: typeof parsed.serverId === 'string' ? parsed.serverId : null,
			channelByServer: parsed.channelByServer ?? {},
			friendId: typeof parsed.friendId === 'string' ? parsed.friendId : null
		};
	} catch {
		return defaults;
	}
}

function persist(selection: LastSelection) {
	untrack(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify(selection));
		} catch {}
	});
}

let selection = $state<LastSelection>(restore());

export const lastSelection = {
	get serverId() {
		return selection.serverId;
	},
	set serverId(value: string | null) {
		selection.serverId = value;
		persist(selection);
	},
	channelFor(serverId: string): string | null {
		return selection.channelByServer[serverId] ?? null;
	},
	setChannel(serverId: string, channelId: string) {
		selection.channelByServer[serverId] = channelId;
		persist(selection);
	},
	get friendId() {
		return selection.friendId;
	},
	set friendId(value: string | null) {
		selection.friendId = value;
		persist(selection);
	}
};
