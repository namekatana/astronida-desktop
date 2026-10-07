import type { Friend } from '$lib/friends/friends';

export function visibleConversations(input: {
	partners: Friend[];
	friendIds: ReadonlySet<string>;
	newestIdOf: (channelId: string) => string | undefined;
}): Friend[] {
	const withNewest = input.partners.flatMap((partner) => {
		if (!partner.channelId || input.friendIds.has(partner.id)) return [];
		const newestId = input.newestIdOf(partner.channelId);
		return newestId === undefined ? [] : [{ partner, newestId }];
	});
	return withNewest
		.sort((a, b) => (a.newestId < b.newestId ? 1 : a.newestId > b.newestId ? -1 : 0))
		.map(({ partner }) => partner);
}
