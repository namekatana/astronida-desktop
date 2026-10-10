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
	locked: boolean;
}

export const settingsGroups: SettingsCategory[][] = [
	[
		{ id: 'account', label: 'Учётная запись', icon: 'account', locked: false },
		{ id: 'privacy', label: 'Конфиденциальность', icon: 'privacy', locked: true },
		{ id: 'safety', label: 'Безопасность', icon: 'safety', locked: true }
	],
	[
		{ id: 'notifications', label: 'Уведомления', icon: 'notifications', locked: true },
		{ id: 'voice', label: 'Голос и видео', icon: 'voiceVideo', locked: true },
		{ id: 'system', label: 'Система', icon: 'system', locked: true }
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
