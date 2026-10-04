import type { Category, Channel } from '$lib/channels/channels';
import { history } from '$lib/history/history';
import type { Friend } from '$lib/friends/friends';
import type { ServerPresence, VoiceMember } from '$lib/presence/presence';
import type { MemberListPreview } from '$lib/servers/member-list.svelte';
import type { Server } from '$lib/servers/servers';
import { createCachedSection } from './cached-section';

export interface CachedAccount {
	username: string | null;
	displayName?: string | null;
	avatarId?: string | null;
	bannerId?: string | null;
	bio?: string | null;
	widgets?: unknown;
	servers: Server[];
	friends: Friend[];
}

export interface Workspace {
	categories: Category[];
	channels: Channel[];
}

interface StoredPresence {
	voice: Record<string, VoiceMember[]>;
}

interface StoredCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	presence: Record<string, StoredPresence>;
	friendsOnline: string[];
	memberPreviews: Record<string, MemberListPreview>;
	presenceLiveAt: number | null;
	previewsLiveAt: Record<string, number>;
}

export interface WorkspaceCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	presence: Record<string, ServerPresence>;
	friendsOnline: Set<string>;
	memberPreviews: Record<string, MemberListPreview>;
}

type Section = keyof StoredCache;

const keyPrefix = 'astronida.cache.';
const sectionNames: Section[] = [
	'account',
	'workspaces',
	'presence',
	'friendsOnline',
	'memberPreviews',
	'presenceLiveAt',
	'previewsLiveAt'
];
const presenceFreshMs = 75_000;
const sections = Object.fromEntries(
	sectionNames.map((name) => [name, createCachedSection(name)])
) as Record<Section, ReturnType<typeof createCachedSection>>;

const empty = (): StoredCache => ({
	account: null,
	workspaces: {},
	presence: {},
	friendsOnline: [],
	memberPreviews: {},
	presenceLiveAt: null,
	previewsLiveAt: {}
});

function isFresh(savedAt: unknown): boolean {
	if (typeof savedAt !== 'number') return false;
	const age = Date.now() - savedAt;
	return age >= 0 && age <= presenceFreshMs;
}

function dropStalePresence(cache: StoredCache): Section[] {
	if (!isFresh(cache.presenceLiveAt)) {
		const dropped = (['presence', 'friendsOnline', 'memberPreviews', 'previewsLiveAt'] as const).filter(
			(section) => Object.keys(cache[section]).length > 0
		);
		cache.presence = {};
		cache.friendsOnline = [];
		cache.memberPreviews = {};
		cache.previewsLiveAt = {};
		return dropped;
	}
	const freshIds = Object.keys(cache.memberPreviews).filter((serverId) =>
		isFresh(cache.previewsLiveAt[serverId])
	);
	if (freshIds.length === Object.keys(cache.memberPreviews).length) return [];
	cache.memberPreviews = Object.fromEntries(
		freshIds.map((serverId) => [serverId, cache.memberPreviews[serverId]])
	);
	cache.previewsLiveAt = Object.fromEntries(
		freshIds.map((serverId) => [serverId, cache.previewsLiveAt[serverId]])
	);
	return ['memberPreviews', 'previewsLiveAt'];
}

let stored: StoredCache = empty();

function voiceWithProfiles(voice: Record<string, VoiceMember[]>): Record<string, VoiceMember[]> {
	return Object.fromEntries(
		Object.entries(voice ?? {}).map(([channelId, members]) => [
			channelId,
			members.map((member) => ({
				...member,
				status: member.status ?? null,
				profile: member.profile ?? null
			}))
		])
	);
}
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
	const [
		account,
		workspaces,
		presence,
		friendsOnline,
		memberPreviews,
		presenceLiveAt,
		previewsLiveAt
	] = await Promise.all([
		readSection(userId, 'account', null),
		readSection(userId, 'workspaces', {}),
		readSection(userId, 'presence', {}),
		readSection(userId, 'friendsOnline', []),
		readSection(userId, 'memberPreviews', {}),
		readSection(userId, 'presenceLiveAt', null),
		readSection(userId, 'previewsLiveAt', {})
	]);
	storedFor = userId;
	stored = {
		account,
		workspaces,
		presence,
		friendsOnline,
		memberPreviews,
		presenceLiveAt,
		previewsLiveAt
	};
	for (const section of dropStalePresence(stored)) scheduleWrite(section);
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
					{ voice: voiceWithProfiles(presence.voice) }
				])
			),
			friendsOnline: new Set(current.friendsOnline),
			memberPreviews: Object.fromEntries(
				Object.entries(current.memberPreviews).map(([serverId, preview]) => [
					serverId,
					{ counts: preview.counts, rows: preview.rows }
				])
			)
		};
	},

	markPresenceLive(userId: string, openServerId: string | null) {
		const cache = current(userId);
		const now = Date.now();
		cache.presenceLiveAt = now;
		scheduleWrite('presenceLiveAt');
		if (!openServerId || !cache.memberPreviews[openServerId]) return;
		cache.previewsLiveAt[openServerId] = now;
		scheduleWrite('previewsLiveAt');
	},

	flush() {
		for (const name of sectionNames) sections[name].flush();
	},

	savePresence(userId: string, serverId: string, presence: ServerPresence) {
		current(userId).presence[serverId] = { voice: presence.voice };
		scheduleWrite('presence');
	},

	saveMemberPreview(userId: string, serverId: string, preview: MemberListPreview) {
		const cache = current(userId);
		cache.memberPreviews[serverId] = preview;
		cache.previewsLiveAt[serverId] = Date.now();
		scheduleWrite('memberPreviews');
		scheduleWrite('previewsLiveAt');
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
