import type { UnreadSnapshot } from './inbox';

interface DirectState {
	count: number;
	newestId: string;
}

const countCap = 99;

let direct = $state<Record<string, DirectState>>({});
let channels = $state<Record<string, string>>({});

export const unread = {
	directCount(channelId: string): number {
		return direct[channelId]?.count ?? 0;
	},
	hasChannel(channelId: string): boolean {
		return channelId in channels;
	},
	get directTotal(): number {
		return Object.values(direct).reduce((sum, entry) => sum + entry.count, 0);
	},
	get channelIds(): string[] {
		return Object.keys(channels);
	},
	newestFor(channelId: string): string | null {
		return direct[channelId]?.newestId ?? channels[channelId] ?? null;
	},
	replace(snapshot: UnreadSnapshot) {
		direct = Object.fromEntries(
			snapshot.direct.map((entry) => [
				entry.channelId,
				{ count: entry.count, newestId: entry.newestId }
			])
		);
		channels = Object.fromEntries(
			snapshot.channels.map((entry) => [entry.channelId, entry.newestId])
		);
	},
	addDirect(channelId: string, messageId: string) {
		const current = direct[channelId];
		if (current && current.newestId >= messageId) return;
		direct[channelId] = {
			count: Math.min((current?.count ?? 0) + 1, countCap),
			newestId: messageId
		};
	},
	addChannel(channelId: string, messageId: string) {
		const current = channels[channelId];
		if (current && current >= messageId) return;
		channels[channelId] = messageId;
	},
	clear(channelId: string, readId: string) {
		const directEntry = direct[channelId];
		if (directEntry && directEntry.newestId <= readId) delete direct[channelId];
		const channelNewest = channels[channelId];
		if (channelNewest && channelNewest <= readId) delete channels[channelId];
	},
	reset() {
		direct = {};
		channels = {};
	}
};
