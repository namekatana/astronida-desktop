import type { Category, Channel } from '$lib/channels/channels';
import { history } from '$lib/history/history';
import type { Friend } from '$lib/friends/friends';
import type { ServerPresence, VoiceMember } from '$lib/presence/presence';
import type { Member } from '$lib/servers/members';
import type { Server } from '$lib/servers/servers';

export interface CachedAccount {
	username: string | null;
	servers: Server[];
	friends: Friend[];
}

export interface Workspace {
	categories: Category[];
	channels: Channel[];
	members: Member[];
}

interface StoredPresence {
	online: string[];
	voice: Record<string, VoiceMember[]>;
}

interface StoredCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	presence: Record<string, StoredPresence>;
	friendsOnline: string[];
}

export interface WorkspaceCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	presence: Record<string, ServerPresence>;
	friendsOnline: Set<string>;
}

type Section = keyof StoredCache;

const keyPrefix = 'astronida.cache.';
const sections: Section[] = ['account', 'workspaces', 'presence', 'friendsOnline'];
const writeDelayMs = 300;

const empty = (): StoredCache => ({
	account: null,
	workspaces: {},
	presence: {},
	friendsOnline: []
});

let stored: StoredCache = empty();
let storedFor: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const dirty = new Set<Section>();

function keyFor(userId: string, section: Section) {
	return `${keyPrefix}${userId}.${section}`;
}

function takeLegacySection(userId: string, section: Section): string | null {
	try {
		const legacy = localStorage.getItem(keyFor(userId, section));
		if (legacy === null) return null;
		void history
			.cachePut(section, legacy)
			.then(() => localStorage.removeItem(keyFor(userId, section)))
			.catch(() => {});
		return legacy;
	} catch {
		return null;
	}
}

async function readSection<K extends Section>(
	userId: string,
	section: K,
	fallback: StoredCache[K]
): Promise<StoredCache[K]> {
	const raw =
		(await history.cacheGet(section).catch(() => null)) ?? takeLegacySection(userId, section);
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as StoredCache[K];
	} catch {
		return fallback;
	}
}

async function load(userId: string): Promise<StoredCache> {
	if (storedFor === userId) return stored;
	const [account, workspaces, presence, friendsOnline] = await Promise.all([
		readSection(userId, 'account', null),
		readSection(userId, 'workspaces', {}),
		readSection(userId, 'presence', {}),
		readSection(userId, 'friendsOnline', [])
	]);
	storedFor = userId;
	stored = { account, workspaces, presence, friendsOnline };
	return stored;
}

function current(userId: string): StoredCache {
	if (storedFor !== userId) {
		storedFor = userId;
		stored = empty();
	}
	return stored;
}

function scheduleWrite(section: Section) {
	dirty.add(section);
	if (writeTimer) clearTimeout(writeTimer);
	writeTimer = setTimeout(() => {
		writeTimer = null;
		for (const changed of dirty) {
			void history.cachePut(changed, JSON.stringify(stored[changed])).catch(() => {});
		}
		dirty.clear();
	}, writeDelayMs);
}

export const workspaceCache = {
	async read(userId: string): Promise<WorkspaceCache> {
		const current = await load(userId);
		return {
			account: current.account,
			workspaces: current.workspaces,
			presence: Object.fromEntries(
				Object.entries(current.presence).map(([serverId, presence]) => [
					serverId,
					{ online: new Set(presence.online), voice: presence.voice }
				])
			),
			friendsOnline: new Set(current.friendsOnline)
		};
	},

	savePresence(userId: string, serverId: string, presence: ServerPresence) {
		current(userId).presence[serverId] = { online: [...presence.online], voice: presence.voice };
		scheduleWrite('presence');
	},

	saveFriendsOnline(userId: string, online: Set<string>) {
		current(userId).friendsOnline = [...online];
		scheduleWrite('friendsOnline');
	},

	saveAccount(userId: string, account: CachedAccount) {
		current(userId).account = account;
		scheduleWrite('account');
	},

	saveWorkspace(userId: string, serverId: string, workspace: Workspace) {
		current(userId).workspaces[serverId] = workspace;
		scheduleWrite('workspaces');
	},

	clear(userId: string) {
		if (writeTimer) clearTimeout(writeTimer);
		writeTimer = null;
		dirty.clear();
		stored = empty();
		storedFor = null;
		try {
			localStorage.removeItem(keyPrefix + userId);
			for (const section of sections) localStorage.removeItem(keyFor(userId, section));
		} catch {
		}
	}
};
