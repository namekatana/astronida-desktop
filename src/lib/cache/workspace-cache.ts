import type { Category, Channel } from '$lib/channels/channels';
import { pageSize, type Message } from '$lib/messages/messages';
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

interface StoredMessage {
	id: string;
	author: Message['author'];
	text: string;
	sentAt: string;
}

interface StoredCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	feeds: Record<string, StoredMessage[]>;
}

export interface WorkspaceCache {
	account: CachedAccount | null;
	workspaces: Record<string, Workspace>;
	feeds: Record<string, Message[]>;
}

const keyPrefix = 'astronida.cache.';
const writeDelayMs = 300;

const empty = (): StoredCache => ({ account: null, workspaces: {}, feeds: {} });

let stored: StoredCache = empty();
let storedFor: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function keyFor(userId: string) {
	return keyPrefix + userId;
}

function toStored(message: Message): StoredMessage {
	return {
		id: message.id,
		author: message.author,
		text: message.text,
		sentAt: message.sentAt.toISOString()
	};
}

function fromStored(message: StoredMessage): Message {
	return { ...message, sentAt: new Date(message.sentAt) };
}

function load(userId: string): StoredCache {
	if (storedFor === userId) return stored;
	storedFor = userId;
	try {
		const raw = localStorage.getItem(keyFor(userId));
		const parsed = raw ? (JSON.parse(raw) as Partial<StoredCache>) : {};
		stored = {
			account: parsed.account ?? null,
			workspaces: parsed.workspaces ?? {},
			feeds: parsed.feeds ?? {}
		};
	} catch {
		stored = empty();
	}
	return stored;
}

function scheduleWrite(userId: string) {
	if (writeTimer) clearTimeout(writeTimer);
	writeTimer = setTimeout(() => {
		writeTimer = null;
		try {
			localStorage.setItem(keyFor(userId), JSON.stringify(stored));
		} catch {
		}
	}, writeDelayMs);
}

export const workspaceCache = {
	read(userId: string): WorkspaceCache {
		const current = load(userId);
		return {
			account: current.account,
			workspaces: current.workspaces,
			feeds: Object.fromEntries(
				Object.entries(current.feeds).map(([channelId, messages]) => [
					channelId,
					messages.map(fromStored)
				])
			)
		};
	},

	saveAccount(userId: string, account: CachedAccount) {
		load(userId).account = account;
		scheduleWrite(userId);
	},

	saveWorkspace(userId: string, serverId: string, workspace: Workspace) {
		load(userId).workspaces[serverId] = workspace;
		scheduleWrite(userId);
	},

	saveFeed(userId: string, channelId: string, messages: Message[]) {
		load(userId).feeds[channelId] = messages
			.filter((message) => message.status === undefined)
			.slice(-pageSize)
			.map(toStored);
		scheduleWrite(userId);
	},

	clear(userId: string) {
		if (writeTimer) clearTimeout(writeTimer);
		writeTimer = null;
		stored = empty();
		storedFor = null;
		try {
			localStorage.removeItem(keyFor(userId));
		} catch {
		}
	}
};
