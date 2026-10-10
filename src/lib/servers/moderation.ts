import { getApi, postApi, type ApiResponse } from '$lib/realtime/api-request';
import { asRecord } from '$lib/ui/record';

export type BanDuration = 3600 | 86400 | 604800 | 2592000 | null;

export interface BanDurationOption {
	value: BanDuration;
	label: string;
}

export const banDurations: BanDurationOption[] = [
	{ value: 3600, label: '1 час' },
	{ value: 86400, label: '1 день' },
	{ value: 604800, label: '1 неделя' },
	{ value: 2592000, label: '1 месяц' },
	{ value: null, label: 'Навсегда' }
];

export interface BannedMember {
	id: string;
	username: string;
	name: string;
	avatarId: string | null;
	expiresAt: Date | null;
}

export type ModerationResult = { ok: true } | { ok: false; message: string };

export type BansResult = { ok: true; bans: BannedMember[] } | { ok: false; message: string };

function failureText(response: ApiResponse | null): string {
	if (!response) return 'Нет связи с сервером';
	if (response.status === 429) return 'Слишком часто, попробуйте через минуту';
	if (response.status === 403) return 'Это может только создатель сервера';
	if (response.status === 404) return 'Пользователь уже не на сервере';
	return 'Не получилось, попробуйте ещё раз';
}

export async function kickMember(serverId: string, userId: string): Promise<ModerationResult> {
	const response = await postApi(`/servers/${serverId}/members/${userId}/kick`, {});
	return response?.status === 200 ? { ok: true } : { ok: false, message: failureText(response) };
}

export async function banMember(
	serverId: string,
	userId: string,
	duration: BanDuration
): Promise<ModerationResult> {
	const response = await postApi(`/servers/${serverId}/members/${userId}/ban`, { duration });
	return response?.status === 200 ? { ok: true } : { ok: false, message: failureText(response) };
}

export async function unbanMember(serverId: string, userId: string): Promise<ModerationResult> {
	const response = await postApi(`/servers/${serverId}/unban`, { user_id: userId });
	if (response?.status === 200 || response?.status === 404) return { ok: true };
	return { ok: false, message: failureText(response) };
}

function bannedMemberFrom(value: unknown): BannedMember | null {
	const record = asRecord(value);
	const user = asRecord(record?.user);
	if (!record || !user) return null;
	const { id, username, display_name: displayName, avatar_id: avatarId } = user;
	if (typeof id !== 'string' || typeof username !== 'string') return null;
	const expiresAt = typeof record.expires_at === 'string' ? new Date(record.expires_at) : null;
	if (expiresAt && Number.isNaN(expiresAt.getTime())) return null;
	return {
		id,
		username,
		name: typeof displayName === 'string' ? displayName : username,
		avatarId: typeof avatarId === 'string' ? avatarId : null,
		expiresAt
	};
}

export async function loadBans(serverId: string): Promise<BansResult> {
	const response = await getApi(`/servers/${serverId}/bans`);
	const list = response?.status === 200 ? asRecord(response.body)?.bans : null;
	if (!Array.isArray(list)) return { ok: false, message: failureText(response) };
	const bans = list.map(bannedMemberFrom).filter((ban): ban is BannedMember => ban !== null);
	return { ok: true, bans };
}

const untilFormat = new Intl.DateTimeFormat('ru-RU', {
	day: 'numeric',
	month: 'long',
	hour: '2-digit',
	minute: '2-digit'
});

export function banUntilLabel(expiresAt: Date | null): string {
	return expiresAt ? `до ${untilFormat.format(expiresAt)}` : 'навсегда';
}

export function banEndsAt(duration: BanDuration, now: Date): Date | null {
	return duration === null ? null : new Date(now.getTime() + duration * 1000);
}
