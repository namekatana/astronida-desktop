import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface Friend {
	id: string;
	username: string;
	name: string;
	channelId: string | null;
}

export type FriendRelation = 'none' | 'friend' | 'outgoing' | 'incoming';

export interface UserSearchResult extends Friend {
	relation: FriendRelation;
}

export const usernameQueryMinLength = 3;
export const usernameMaxLength = 20;

export function normalizeUsernameQuery(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '')
		.slice(0, usernameMaxLength);
}

async function loadDirectChannels(userId: string): Promise<Map<string, string>> {
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('direct_channels')
			.select('channel_id, user_a, user_b')
			.or(`user_a.eq.${userId},user_b.eq.${userId}`)
	);

	if (error || !data) return new Map();
	return new Map(
		data.map((row) => [row.user_a === userId ? row.user_b : row.user_a, row.channel_id])
	);
}

export async function loadFriends(userId: string): Promise<Friend[]> {
	const [{ data, error }, channelByFriend] = await Promise.all([
		retryOnFreshToken(() =>
			supabase
				.from('friendships')
				.select(
					'user_a, user_b, a:profiles!friendships_user_a_fkey (username, display_name), b:profiles!friendships_user_b_fkey (username, display_name)'
				)
				.or(`user_a.eq.${userId},user_b.eq.${userId}`)
		),
		loadDirectChannels(userId)
	]);

	if (error || !data) return [];

	return data.flatMap((row) => {
		const mine = row.user_a === userId;
		const id = mine ? row.user_b : row.user_a;
		const profile = mine ? row.b : row.a;
		if (!profile) return [];
		return {
			id,
			username: profile.username,
			name: profile.display_name,
			channelId: channelByFriend.get(id) ?? null
		};
	});
}
