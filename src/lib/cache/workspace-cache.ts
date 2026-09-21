import type { Category, Channel } from '$lib/channels/channels';
import type { ServerPresence, VoiceMember } from '$lib/presence/presence';
import type { Member } from '$lib/servers/members';
import type { Server } from '$lib/servers/servers';

export interface CachedAccount {
	username: string | null;
	servers: Server[];
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
}

export interface WorkspaceCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	presence: Record<string, ServerPresence>;
}

type Section = keyof StoredCache;

const keyPrefix = 'astronida.cache.';
const sections: Section[] = ['account', 'workspaces', 'presence'];
const writeDelayMs = 300;

const empty = (): StoredCache => ({ account: null, workspaces: {}, presence: {} });

let stored: StoredCache = empty();
let storedFor: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const dirty = new Set<Section>();

function keyFor(userId: string, section: Section) {
	return `${keyPrefix}${userId}.${section}`;
}

function readSection<K extends Section>(userId: string, section: K, fallback: StoredCache[K]) {
	try {
		const raw = localStorage.getItem(keyFor(userId, section));
		return raw ? (JSON.parse(raw) as StoredCache[K]) : fallback;
	} catch {
		return fallback;
	}
}

function load(userId: string): StoredCache {
	if (storedFor === userId) return stored;
	storedFor = userId;
	stored = {
		account: readSection(userId, 'account', null),
		workspaces: readSection(userId, 'workspaces', {}),
		presence: readSection(userId, 'presence', {})
	};
	return stored;
}

function scheduleWrite(userId: string, section: Section) {
	dirty.add(section);
	if (writeTimer) clearTimeout(writeTimer);
	writeTimer = setTimeout(() => {
		writeTimer = null;
		for (const changed of dirty) {
			try {
				localStorage.setItem(keyFor(userId, changed), JSON.stringify(stored[changed]));
			} catch {
			}
		}
		dirty.clear();
	}, writeDelayMs);
}

export const workspaceCache = {
	read(userId: string): WorkspaceCache {
		const current = load(userId);
		return {
			account: current.account,
			workspaces: current.workspaces,
			presence: Object.fromEntries(
				Object.entries(current.presence).map(([serverId, presence]) => [
					serverId,
					{ online: new Set(presence.online), voice: presence.voice }
				])
			)
		};
	},

	savePresence(userId: string, serverId: string, presence: ServerPresence) {
		load(userId).presence[serverId] = { online: [...presence.online], voice: presence.voice };
		scheduleWrite(userId, 'presence');
	},

	saveAccount(userId: string, account: CachedAccount) {
		load(userId).account = account;
		scheduleWrite(userId, 'account');
	},

	saveWorkspace(userId: string, serverId: string, workspace: Workspace) {
		load(userId).workspaces[serverId] = workspace;
		scheduleWrite(userId, 'workspaces');
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
