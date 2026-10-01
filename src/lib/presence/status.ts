export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export type PresenceStatus = Exclude<UserStatus, 'invisible'>;

export const userStatuses: readonly UserStatus[] = ['online', 'idle', 'dnd', 'invisible'];

export const statusLabels: Record<UserStatus, string> = {
	online: 'В сети',
	idle: 'Неактивен',
	dnd: 'Не беспокоить',
	invisible: 'Невидимка'
};

export const statusHints: Partial<Record<UserStatus, string>> = {
	dnd: 'Без звуков и уведомлений',
	invisible: 'Для всех — не в сети'
};

export const statusDotClass: Record<UserStatus, string> = {
	online: 'bg-online',
	idle: 'bg-warning',
	dnd: 'bg-danger',
	invisible: 'status-invisible'
};

export const statusTextClass: Record<UserStatus, string> = {
	online: 'text-online',
	idle: 'text-warning',
	dnd: 'text-danger',
	invisible: 'text-muted'
};

export function userStatusFrom(value: unknown): UserStatus | null {
	return typeof value === 'string' && (userStatuses as readonly string[]).includes(value)
		? (value as UserStatus)
		: null;
}

export function presenceStatusFrom(value: unknown): PresenceStatus {
	const status = userStatusFrom(value);
	return status === null || status === 'invisible' ? 'online' : status;
}
