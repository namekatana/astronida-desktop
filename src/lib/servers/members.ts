import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface Member {
	id: string;
	username: string;
	name: string;
	online: boolean;
	owner: boolean;
}

export interface JoinedMember {
	id: string;
	username: string;
	name: string;
}

export function joinedMemberFrom(payload: unknown): JoinedMember | null {
	if (typeof payload !== 'object' || payload === null || !('user' in payload)) return null;
	const user = payload.user;
	if (typeof user !== 'object' || user === null) return null;
	const row = user as Record<string, unknown>;
	if (typeof row.id !== 'string' || typeof row.username !== 'string') return null;
	if (typeof row.display_name !== 'string') return null;
	return { id: row.id, username: row.username, name: row.display_name };
}

export async function loadMembers(serverId: string, ownerId: string): Promise<Member[]> {
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('server_members')
			.select('user_id, joined_at, profiles (username, display_name)')
			.eq('server_id', serverId)
			.order('joined_at')
	);

	if (error || !data) return [];

	return data.flatMap((row) => {
		if (!row.profiles) return [];
		return {
			id: row.user_id,
			username: row.profiles.username,
			name: row.profiles.display_name,
			online: false,
			owner: row.user_id === ownerId
		};
	});
}
