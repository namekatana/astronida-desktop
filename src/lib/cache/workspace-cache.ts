import type { Category, Channel } from '$lib/channels/channels';
import { history } from '$lib/history/history';
import type { Friend } from '$lib/friends/friends';
import type { ServerPresence, VoiceMember } from '$lib/presence/presence';
import type { Member } from '$lib/servers/members';
import type { Server } from '$lib/servers/servers';
import { createCachedSection } from './cached-section';

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
const sectionNames: Section[] = ['account', 'workspaces', 'presence', 'friendsOnline'];
const sections = Object.fromEntries(
	sectionNames.map((name) => [name, createCachedSection(name)])
) as Record<Section, ReturnType<typeof createCachedSection>>;

const empty = (): StoredCache => ({
	account: null,
	workspaces: {},
	presence: {},
	friendsOnline: []
});

let stored: StoredCache = empty();
let storedFor: string | null = null;

function keyFor(userId: string, section: Section) {
	return `${keyPrefix}${userId}.${section}`;
}

function takeLegacySection(userId: string, section: Section): unknown {
	try {
		const legacy = localStorage.getItem(keyFor(userId, section));
		if (legacy === null) return null;
		void history
			.cachePut(section, legacy)
			.then(() => localStorage.removeItem(keyFor(userId, section)))
			.catch(() => {});
		return JSON.parse(legacy) as unknown;
	} catch {
		return null;
	}
}

async function readSection<K extends Section>(
	userId: string,
	section: K,
	fallback: StoredCache[K]
): Promise<StoredCache[K]> {
	const value = (await sections[section].read()) ?? takeLegacySection(userId, section);
	return (value ?? fallback) as StoredCache[K];
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
	sections[section].persist(() => stored[section]);
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
		for (const name of sectionNames) sections[name].cancel();
		stored = empty();
		storedFor = null;
		try {
			localStorage.removeItem(keyPrefix + userId);
			for (const name of sectionNames) localStorage.removeItem(keyFor(userId, name));
		} catch {
		}
	}
};
