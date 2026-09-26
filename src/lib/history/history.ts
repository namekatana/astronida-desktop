import { invoke } from '@tauri-apps/api/core';
import { pageSize, type Message } from '$lib/messages/messages';

export interface HistoryPage {
	messages: Message[];
	reachedStart: boolean;
}

export interface HistoryCoverage {
	before?: string;
	hasMore: boolean;
}

export interface StoreOptions {
	coverage?: HistoryCoverage;
	reachedStart?: boolean;
}

interface HistoryBackend {
	open(userId: string): Promise<void>;
	page(channelId: string, before?: string): Promise<HistoryPage>;
	store(channelId: string, messages: Message[], options?: StoreOptions): Promise<void>;
	newestIds(): Promise<Record<string, string>>;
	latestMessages(channelIds: string[]): Promise<Record<string, Message>>;
	dropChannel(channelId: string): Promise<void>;
	clear(): Promise<void>;
}

interface StoredMessage {
	id: string;
	channelId: string;
	author: { id: string; username: string; displayName: string };
	content: string;
	sentAt: string;
}

function toStored(channelId: string, message: Message): StoredMessage {
	return {
		id: message.id,
		channelId,
		author: {
			id: message.author.id,
			username: message.author.username,
			displayName: message.author.name
		},
		content: message.text,
		sentAt: message.sentAt.toISOString()
	};
}

function fromStored(stored: StoredMessage): Message {
	return {
		id: stored.id,
		author: {
			id: stored.author.id,
			username: stored.author.username,
			name: stored.author.displayName
		},
		text: stored.content,
		sentAt: new Date(stored.sentAt)
	};
}

function confirmed(channelId: string, messages: Message[]): StoredMessage[] {
	return messages
		.filter((message) => message.status === undefined)
		.map((message) => toStored(channelId, message));
}

function isTauri() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const tauriBackend: HistoryBackend = {
	open(userId) {
		return invoke('history_open', { userId });
	},

	async page(channelId, before) {
		const page = await invoke<{ messages: StoredMessage[]; reachedStart: boolean }>(
			'history_page',
			{ channelId, before: before ?? null }
		);
		return { messages: page.messages.map(fromStored), reachedStart: page.reachedStart };
	},

	store(channelId, messages, options = {}) {
		return invoke('history_store', {
			channelId,
			messages: confirmed(channelId, messages),
			coverage: options.coverage ?? null,
			reachedStart: options.reachedStart ?? null
		});
	},

	newestIds() {
		return invoke<Record<string, string>>('history_newest_ids');
	},

	async latestMessages(channelIds) {
		const latest = await invoke<StoredMessage[]>('history_latest_messages', { channelIds });
		return Object.fromEntries(latest.map((stored) => [stored.channelId, fromStored(stored)]));
	},

	dropChannel(channelId) {
		return invoke('history_drop_channel', { channelId });
	},

	clear() {
		return invoke('history_clear');
	}
};

function createMemoryBackend(): HistoryBackend {
	const rows = new Map<string, StoredMessage>();
	const reachedStart = new Map<string, boolean>();
	let openedFor: string | null = null;

	return {
		async open(userId) {
			if (openedFor !== userId) {
				rows.clear();
				reachedStart.clear();
			}
			openedFor = userId;
		},

		async page(channelId, before) {
			const messages = [...rows.values()]
				.filter((row) => row.channelId === channelId && (before === undefined || row.id < before))
				.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
				.slice(0, pageSize)
				.reverse()
				.map(fromStored);
			return { messages, reachedStart: reachedStart.get(channelId) ?? false };
		},

		async store(channelId, messages, options = {}) {
			const incoming = confirmed(channelId, messages);
			for (const row of incoming) rows.set(row.id, row);
			const coverage = options.coverage;
			if (coverage) {
				const oldest = coverage.hasMore ? incoming.map((row) => row.id).sort()[0] : undefined;
				if (!(coverage.hasMore && oldest === undefined)) {
					const present = new Set(incoming.map((row) => row.id));
					for (const [id, row] of rows) {
						if (row.channelId !== channelId || present.has(id)) continue;
						if (oldest !== undefined && id < oldest) continue;
						if (coverage.before !== undefined && id >= coverage.before) continue;
						rows.delete(id);
					}
				}
			}
			if (options.reachedStart !== undefined) reachedStart.set(channelId, options.reachedStart);
		},

		async newestIds() {
			const newest: Record<string, string> = {};
			for (const row of rows.values()) {
				const known = newest[row.channelId];
				if (known === undefined || row.id > known) newest[row.channelId] = row.id;
			}
			return newest;
		},

		async latestMessages(channelIds) {
			const wanted = new Set(channelIds);
			const latest: Record<string, StoredMessage> = {};
			for (const row of rows.values()) {
				if (!wanted.has(row.channelId)) continue;
				const known = latest[row.channelId];
				if (known === undefined || row.id > known.id) latest[row.channelId] = row;
			}
			return Object.fromEntries(
				Object.entries(latest).map(([channelId, row]) => [channelId, fromStored(row)])
			);
		},

		async dropChannel(channelId) {
			for (const [id, row] of rows) {
				if (row.channelId === channelId) rows.delete(id);
			}
			reachedStart.delete(channelId);
		},

		async clear() {
			rows.clear();
			reachedStart.clear();
		}
	};
}

export const history: HistoryBackend = isTauri() ? tauriBackend : createMemoryBackend();
