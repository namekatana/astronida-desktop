import { history, type HistoryCoverage, type HistoryPage } from '$lib/history/history';
import { compareIds, loadMessages, pageSize, type Message } from './messages';

interface Feed {
	messages: Message[];
	hasMore: boolean;
	localExhausted: boolean;
	ready: boolean;
}

const maxCatchUpPages = 10;

export type Feeds = ReturnType<typeof createFeeds>;

export function createFeeds() {
	const feeds = $state<Record<string, Feed>>({});
	const storedLatest = $state<Record<string, Message>>({});
	const syncs = new Map<string, Promise<void>>();

	function feedFor(channelId: string): Feed {
		return (feeds[channelId] ??= {
			messages: [],
			hasMore: false,
			localExhausted: false,
			ready: false
		});
	}

	function has(channelId: string): boolean {
		return channelId in feeds;
	}

	function isLoaded(channelId: string): boolean {
		return feeds[channelId]?.ready ?? false;
	}

	function messagesOf(channelId: string): Message[] {
		return feeds[channelId]?.messages ?? [];
	}

	function hasMoreOf(channelId: string): boolean {
		return feeds[channelId]?.hasMore ?? false;
	}

	function latestOf(channelId: string): Message | undefined {
		return feeds[channelId]?.messages.at(-1) ?? storedLatest[channelId];
	}

	function dropMissing(feed: Feed, incoming: Message[], coverage: HistoryCoverage): boolean {
		const oldest = coverage.hasMore ? incoming[0]?.id : undefined;
		if (coverage.hasMore && oldest === undefined) return false;
		const present = new Set(incoming.map((m) => m.id));
		const kept = feed.messages.filter(
			(m) =>
				m.status !== undefined ||
				present.has(m.id) ||
				(oldest !== undefined && m.id < oldest) ||
				(coverage.before !== undefined && m.id >= coverage.before)
		);
		if (kept.length === feed.messages.length) return false;
		feed.messages = kept;
		return true;
	}

	function mergeMessages(channelId: string, incoming: Message[], coverage?: HistoryCoverage) {
		const feed = feedFor(channelId);
		if (coverage) dropMissing(feed, incoming, coverage);
		const known = new Set(feed.messages.map((m) => m.id));
		const fresh = incoming.filter((message) => !known.has(message.id));
		if (fresh.length === 0) return;
		const last = feed.messages.at(-1);
		const appendsInOrder =
			fresh.every((m, i) => i === 0 || fresh[i - 1].id < m.id) && (!last || last.id < fresh[0].id);
		feed.messages.push(...fresh);
		if (!appendsInOrder) feed.messages.sort(compareIds);
	}

	function absorb(
		channelId: string,
		incoming: Message[],
		options?: { coverage?: HistoryCoverage; reachedStart?: boolean }
	) {
		mergeMessages(channelId, incoming, options?.coverage);
		history.store(channelId, incoming, options).catch(() => {});
	}

	function rememberLatest(channelId: string, message: Message) {
		const known = storedLatest[channelId];
		if (!known || known.id < message.id) storedLatest[channelId] = message;
	}

	function storeOnDisk(channelId: string, message: Message) {
		history.store(channelId, [message]).catch(() => {});
		rememberLatest(channelId, message);
	}

	function loadLatest(channelIds: string[]) {
		const missing = channelIds.filter((id) => !(id in storedLatest));
		if (missing.length === 0) return;
		history
			.latestMessages(missing)
			.then((latest) => {
				for (const [channelId, message] of Object.entries(latest)) {
					rememberLatest(channelId, message);
				}
			})
			.catch(() => {});
	}

	function addPending(channelId: string, message: Message) {
		feedFor(channelId).messages.push(message);
	}

	function removeMessage(channelId: string, messageId: string) {
		const feed = feeds[channelId];
		if (feed) feed.messages = feed.messages.filter((m) => m.id !== messageId);
	}

	function forget(channelId: string, messageId: string) {
		const feed = feeds[channelId];
		if (feed) {
			feed.messages = feed.messages.filter((m) => m.id !== messageId);
			for (const message of feed.messages) {
				if (message.replyTo?.id === messageId && message.replyTo.original) {
					message.replyTo = { id: messageId, original: null };
				}
			}
		}
		const removal = history.removeMessage(channelId, messageId).catch(() => {});
		if (storedLatest[channelId]?.id !== messageId) return;
		delete storedLatest[channelId];
		removal
			.then(() => history.latestMessages([channelId]))
			.then((latest) => {
				const message = latest[channelId];
				if (message) rememberLatest(channelId, message);
			})
			.catch(() => {});
	}

	function markFailed(channelId: string, messageId: string) {
		const pending = feeds[channelId]?.messages.find((m) => m.id === messageId);
		if (pending) pending.status = 'failed';
	}

	function seed(channelId: string, page: HistoryPage) {
		const feed = feedFor(channelId);
		mergeMessages(channelId, page.messages);
		feed.localExhausted = page.messages.length < pageSize;
		feed.hasMore = !feed.localExhausted || !page.reachedStart;
		if (page.messages.length > 0 || page.reachedStart) feed.ready = true;
	}

	async function readDisk(channelId: string, before?: string): Promise<boolean> {
		try {
			seed(channelId, await history.page(channelId, before));
			return true;
		} catch {
			feedFor(channelId).localExhausted = true;
			return false;
		}
	}

	async function open(channelId: string) {
		const feed = feedFor(channelId);
		if (isLoaded(channelId)) return;
		if (!(await readDisk(channelId))) feed.hasMore = true;
	}

	function newestConfirmedId(feed: Feed): string | undefined {
		for (let i = feed.messages.length - 1; i >= 0; i--) {
			if (feed.messages[i].status === undefined) return feed.messages[i].id;
		}
		return undefined;
	}

	function sync(channelId: string): Promise<void> {
		const next = (syncs.get(channelId) ?? Promise.resolve())
			.then(() => syncChannel(channelId))
			.catch(() => {});
		syncs.set(channelId, next);
		return next;
	}

	async function syncChannel(channelId: string) {
		const feed = feedFor(channelId);
		const newestLocal = newestConfirmedId(feed);
		const latest = await loadMessages({ channelId });
		if (!latest) return;
		absorb(channelId, latest.messages, {
			coverage: { hasMore: latest.hasMore },
			reachedStart: latest.hasMore ? undefined : true
		});
		feed.ready = true;
		const oldest = latest.messages[0]?.id;
		if (newestLocal === undefined || !latest.hasMore || oldest === undefined) {
			feed.localExhausted = true;
			feed.hasMore = latest.hasMore;
			return;
		}
		if (oldest <= newestLocal) return;

		let cursor = newestLocal;
		for (let page = 1; page < maxCatchUpPages; page++) {
			const loaded = await loadMessages({ channelId, after: cursor });
			if (!loaded) return;
			absorb(channelId, loaded.messages);
			const last = loaded.messages.at(-1)?.id;
			if (!loaded.hasMore || last === undefined || last >= oldest) return;
			cursor = last;
		}
		await resetFeed(channelId);
	}

	async function resetFeed(channelId: string) {
		const latest = await loadMessages({ channelId });
		if (!latest) return;
		await history.dropChannel(channelId);
		const feed = feedFor(channelId);
		feed.messages = feed.messages.filter((m) => m.status !== undefined);
		absorb(channelId, latest.messages, { reachedStart: !latest.hasMore });
		feed.ready = true;
		feed.localExhausted = true;
		feed.hasMore = latest.hasMore;
	}

	async function loadOlderFromServer(channelId: string, before: string) {
		const loaded = await loadMessages({ channelId, before });
		if (!loaded) return;
		absorb(channelId, loaded.messages, {
			coverage: { before, hasMore: loaded.hasMore },
			reachedStart: !loaded.hasMore
		});
		feedFor(channelId).hasMore = loaded.hasMore;
	}

	async function loadOlder(channelId: string, before: string) {
		if (feedFor(channelId).localExhausted) {
			await loadOlderFromServer(channelId, before);
		} else {
			await readDisk(channelId, before);
		}
	}

	return {
		feedFor,
		has,
		isLoaded,
		messagesOf,
		hasMoreOf,
		latestOf,
		absorb,
		storeOnDisk,
		loadLatest,
		addPending,
		removeMessage,
		forget,
		markFailed,
		seed,
		open,
		sync,
		loadOlder
	};
}
