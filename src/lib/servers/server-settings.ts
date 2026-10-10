import type { ConstellationName } from '$lib/ui/constellations';
import type { IconName } from '$lib/ui/icons';

export type ServerSettingsSectionId = 'overview' | 'members' | 'roles' | 'invites' | 'bans';

export interface ServerSettingsSection {
	id: ServerSettingsSectionId;
	label: string;
	icon: IconName;
	locked: boolean;
	summary: string;
	constellation: ConstellationName | null;
}

export const serverSettingsGroups: ServerSettingsSection[][] = [
	[
		{
			id: 'overview',
			label: 'Главное',
			icon: 'gear',
			locked: true,
			summary: 'Название и значок сервера',
			constellation: 'cassiopeia'
		},
		{
			id: 'members',
			label: 'Участники',
			icon: 'users',
			locked: true,
			summary: 'Список участников и поиск по нему',
			constellation: 'bigDipper'
		},
		{
			id: 'roles',
			label: 'Роли',
			icon: 'roles',
			locked: true,
			summary: 'Права участников: кто может удалять, закреплять и приглашать',
			constellation: 'orion'
		},
		{
			id: 'invites',
			label: 'Приглашения',
			icon: 'link',
			locked: false,
			summary: 'Ссылки-приглашения, их сроки и отзыв',
			constellation: 'cygnus'
		}
	],
	[
		{
			id: 'bans',
			label: 'Заблокированные',
			icon: 'member-ban',
			locked: false,
			summary: 'Кто не может вернуться на сервер по приглашению',
			constellation: null
		}
	]
];

let lastSection: ServerSettingsSectionId = 'bans';

export function rememberedServerSection(): ServerSettingsSectionId {
	return lastSection;
}

export function rememberServerSection(id: ServerSettingsSectionId) {
	lastSection = id;
}

export function serverSettingsSection(id: ServerSettingsSectionId): ServerSettingsSection {
	return serverSettingsGroups.flat().find((section) => section.id === id) ?? serverSettingsGroups[1][0];
}
