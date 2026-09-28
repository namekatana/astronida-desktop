import type { UnreadSnapshot } from './inbox';

export type UnreadMark = { after: string | null } | { from: string };

interface DirectState {
	count: number;
	newestId: string;
	mark: UnreadMark;
}

interface ChannelState {
	newestId: string;
	mark: UnreadMark;
}

const countCap = 99;

let direct = $state<Record<string, DirectState>>({});
let channels = $state<Record<string, ChannelState>>({});

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
		return direct[channelId]?.newestId ?? channels[channelId]?.newestId ?? null;
	},
	markFor(channelId: string): UnreadMark | null {
		return direct[channelId]?.mark ?? channels[channelId]?.mark ?? null;
	},
	replace(snapshot: UnreadSnapshot) {
		direct = Object.fromEntries(
			snapshot.direct.map((entry) => [
				entry.channelId,
				{ count: entry.count, newestId: entry.newestId, mark: { after: entry.readId } }
			])
		);
		channels = Object.fromEntries(
			snapshot.channels.map((entry) => [
				entry.channelId,
				{ newestId: entry.newestId, mark: { after: entry.readId } }
			])
		);
	},
	addDirect(channelId: string, messageId: string) {
		const current = direct[channelId];
		if (current && current.newestId >= messageId) return;
		direct[channelId] = {
			count: Math.min((current?.count ?? 0) + 1, countCap),
			newestId: messageId,
			mark: current?.mark ?? { from: messageId }
		};
	},
	addChannel(channelId: string, messageId: string) {
		const current = channels[channelId];
		if (current && current.newestId >= messageId) return;
		channels[channelId] = { newestId: messageId, mark: current?.mark ?? { from: messageId } };
	},
	clear(channelId: string, readId: string) {
		const directEntry = direct[channelId];
		if (directEntry && directEntry.newestId <= readId) delete direct[channelId];
		const channelEntry = channels[channelId];
		if (channelEntry && channelEntry.newestId <= readId) delete channels[channelId];
	},
	reset() {
		direct = {};
		channels = {};
	}
};
