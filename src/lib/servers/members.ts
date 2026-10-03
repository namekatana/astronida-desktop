import type { UserStatus } from '$lib/presence/status';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export interface Member {
	id: string;
	username: string;
	name: string;
	avatarId?: string | null;
	online: boolean;
	status?: UserStatus;
	owner: boolean;
}

const membershipChunk = 200;

export async function membersAmong(serverId: string, userIds: string[]): Promise<Set<string>> {
	const members = new Set<string>();
	for (let offset = 0; offset < userIds.length; offset += membershipChunk) {
		const chunk = userIds.slice(offset, offset + membershipChunk);
		const { data } = await retryOnFreshToken(() =>
			supabase
				.from('server_members')
				.select('user_id')
				.eq('server_id', serverId)
				.in('user_id', chunk)
		);
		for (const row of data ?? []) members.add(row.user_id);
	}
	return members;
}
