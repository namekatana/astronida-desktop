import { history } from '$lib/history/history';
import { prefetchImages } from '$lib/media/images';
import type { Feeds } from '$lib/messages/feeds.svelte';
import type { Message } from '$lib/messages/messages';
import type { UnreadSnapshot } from '$lib/notifications/inbox';
import { connection } from '$lib/realtime/connection.svelte';

const syncConcurrency = 4;

async function runLimited(items: string[], task: (item: string) => Promise<void>) {
	const queue = [...items];
	const worker = async () => {
		for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
			await task(item).catch(() => {});
		}
	};
	await Promise.all(Array.from({ length: Math.min(syncConcurrency, queue.length) }, worker));
}

export type Sync = ReturnType<typeof createSync>;

export function createSync(feeds: Feeds) {
	const warmFeeds = new Set<string>();
	let syncEpoch = 0;

	function markWarm(channelId: string) {
		warmFeeds.add(channelId);
	}

	function warm(channelId: string): Promise<void> {
		if (warmFeeds.has(channelId)) return Promise.resolve();
		warmFeeds.add(channelId);
		return feeds.open(channelId).then(() => feeds.sync(channelId));
	}

	function receive(channelId: string, message: Message) {
		prefetchImages(message.attachments);
		if (!warmFeeds.has(channelId)) {
			void warm(channelId);
			return;
		}
		if (feeds.has(channelId)) {
			feeds.absorb(channelId, [message]);
			return;
		}
		feeds.storeOnDisk(channelId, message);
	}

	async function synchronize(snapshot: UnreadSnapshot) {
		const epoch = ++syncEpoch;
		warmFeeds.clear();
		connection.setUpdating(true);

		const local = await history.newestIds().catch((): Record<string, string> => ({}));
		if (epoch !== syncEpoch) return;

		const stale = snapshot.latest.flatMap((entry) => {
			if (local[entry.channelId] !== entry.newestId) return [entry.channelId];
			warmFeeds.add(entry.channelId);
			return [];
		});

		await runLimited(stale, (channelId) =>
			epoch === syncEpoch ? warm(channelId) : Promise.resolve()
		);
		if (epoch === syncEpoch) connection.setUpdating(false);
	}

	function stop() {
		syncEpoch += 1;
		connection.setUpdating(false);
	}

	type ForgetListener = (channelId: string, messageId: string) => void;
	const forgetListeners = new Set<ForgetListener>();

	function forget(channelId: string, messageId: string) {
		feeds.forget(channelId, messageId);
		for (const listener of forgetListeners) listener(channelId, messageId);
	}

	function onForget(listener: ForgetListener): () => void {
		forgetListeners.add(listener);
		return () => forgetListeners.delete(listener);
	}

	return { markWarm, warm, receive, synchronize, stop, forget, onForget };
}
