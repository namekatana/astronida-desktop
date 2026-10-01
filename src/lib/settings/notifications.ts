export type NotificationSettingId =
	| 'desktop'
	| 'messagePreview'
	| 'unreadBadge'
	| 'directMessages'
	| 'friendRequests'
	| 'serverChannels'
	| 'notificationSound'
	| 'voiceSounds';

export interface NotificationSetting {
	id: NotificationSettingId;
	label: string;
	description?: string;
}

export interface NotificationSection {
	id: string;
	title: string;
	note?: string;
	items: NotificationSetting[];
}

export const notificationSections: NotificationSection[] = [
	{
		id: 'windows',
		title: 'Уведомления Windows',
		items: [
			{ id: 'desktop', label: 'Показывать уведомления', description: 'И мигать на панели задач' },
			{
				id: 'messagePreview',
				label: 'Текст сообщения',
				description: 'Иначе в уведомлении будет «Новое сообщение»'
			},
			{ id: 'unreadBadge', label: 'Счётчик на значке', description: 'Число непрочитанных личных' }
		]
	},
	{
		id: 'sources',
		title: 'Уведомлять о',
		note: 'Непрочитанные каналы всегда отмечаются точкой в приложении',
		items: [
			{ id: 'directMessages', label: 'Личных сообщениях' },
			{ id: 'friendRequests', label: 'Запросах в друзья' },
			{ id: 'serverChannels', label: 'Сообщениях в каналах серверов' }
		]
	},
	{
		id: 'sounds',
		title: 'Звуки',
		items: [
			{ id: 'notificationSound', label: 'Звук уведомлений' },
			{
				id: 'voiceSounds',
				label: 'Звуки голосового канала',
				description: 'Вход и выход участников, микрофон и звук'
			}
		]
	}
];

export const defaultNotificationSettings: Record<NotificationSettingId, boolean> = {
	desktop: true,
	messagePreview: true,
	unreadBadge: true,
	directMessages: true,
	friendRequests: true,
	serverChannels: false,
	notificationSound: true,
	voiceSounds: true
};
