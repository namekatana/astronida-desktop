import type { Friend } from '$lib/friends/friends';
import { knownAvatars } from '$lib/profile/known-avatars.svelte';
import { failureMessage, postApi } from '$lib/realtime/api-request';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export type OpenDirectResult = { ok: true; partner: Friend } | { ok: false; message: string };

type PartnerProfile = { username: string; display_name: string; avatar_id: string | null } | null;

function partnerFrom(id: string, profile: PartnerProfile, channelId: string): Friend | null {
	if (!profile) return null;
	knownAvatars.learn(id, profile.avatar_id);
	return {
		id,
		username: profile.username,
		name: profile.display_name,
		avatarId: profile.avatar_id,
		channelId
	};
}

export async function loadConversations(userId: string): Promise<Friend[]> {
	const { data, error } = await retryOnFreshToken(() =>
		supabase
			.from('direct_channels')
			.select(
				'channel_id, user_a, user_b, a:profiles!direct_channels_user_a_fkey (username, display_name, avatar_id), b:profiles!direct_channels_user_b_fkey (username, display_name, avatar_id)'
			)
			.or(`user_a.eq.${userId},user_b.eq.${userId}`)
	);
	if (error || !data) return [];

	return data.flatMap((row) => {
		const mine = row.user_a === userId;
		const partner = partnerFrom(
			mine ? row.user_b : row.user_a,
			mine ? row.b : row.a,
			row.channel_id
		);
		return partner ? [partner] : [];
	});
}

interface OpenedPayload {
	channel_id: string;
	user: { id: string; username: string; display_name: string; avatar_id: string | null };
}

function isOpenedPayload(body: unknown): body is OpenedPayload {
	if (typeof body !== 'object' || body === null) return false;
	const { channel_id, user } = body as Record<string, unknown>;
	return typeof channel_id === 'string' && typeof user === 'object' && user !== null;
}

const openFailed = 'Не удалось открыть чат — проверьте соединение';

function openFailureMessage(status: number | undefined, fallback: string): string {
	if (status === 403) return 'Написать можно только друзьям и участникам общего сервера';
	if (status === 404) return 'Пользователь не найден';
	return fallback;
}

export async function openDirect(userId: string): Promise<OpenDirectResult> {
	const response = await postApi('/direct', { user_id: userId });
	if (response?.status !== 200 || !isOpenedPayload(response.body)) {
		const fallback = failureMessage(response, { limit: openFailed, failed: openFailed });
		return { ok: false, message: openFailureMessage(response?.status, fallback) };
	}
	const { channel_id, user } = response.body;
	const partner = partnerFrom(user.id, user, channel_id);
	return partner ? { ok: true, partner } : { ok: false, message: openFailed };
}
