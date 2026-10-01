import type { IconName } from '$lib/ui/icons';

export type SettingsCategoryId =
	| 'account'
	| 'privacy'
	| 'safety'
	| 'notifications'
	| 'voice'
	| 'system';

export interface SettingsCategory {
	id: SettingsCategoryId;
	label: string;
	icon: IconName;
}

export const settingsGroups: SettingsCategory[][] = [
	[
		{ id: 'account', label: 'Учётная запись', icon: 'account' },
		{ id: 'privacy', label: 'Конфиденциальность', icon: 'privacy' },
		{ id: 'safety', label: 'Безопасность', icon: 'safety' }
	],
	[
		{ id: 'notifications', label: 'Уведомления', icon: 'notifications' },
		{ id: 'voice', label: 'Голос и видео', icon: 'voiceVideo' },
		{ id: 'system', label: 'Система', icon: 'system' }
	]
];

const storageKey = 'astronida.settings.category';
const defaultCategory: SettingsCategoryId = 'account';

function isCategoryId(value: string | null): value is SettingsCategoryId {
	return settingsGroups.some((group) => group.some((category) => category.id === value));
}

export function rememberedCategory(): SettingsCategoryId {
	try {
		const stored = localStorage.getItem(storageKey);
		return isCategoryId(stored) ? stored : defaultCategory;
	} catch {
		return defaultCategory;
	}
}

export function rememberCategory(id: SettingsCategoryId) {
	try {
		localStorage.setItem(storageKey, id);
	} catch {}
}

export function categoryLabel(id: SettingsCategoryId): string {
	return settingsGroups.flat().find((category) => category.id === id)?.label ?? '';
}
