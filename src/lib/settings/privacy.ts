export type PrivacyItemId =
	| 'avatar'
	| 'description'
	| 'banner'
	| 'friendRequests'
	| 'onlineStatus'
	| 'forwardName'
	| 'serverInvites';
export type PrivacyAudience = 'everyone' | 'friends' | 'mutualServers' | 'nobody';
export type PrivacyException = 'always' | 'never';
export type PrivacyPageId = PrivacyItemId | 'blocked' | 'autoDelete';
export type DeletionPeriod = 1 | 3 | 6 | 12;

export interface PrivacyItem {
	id: PrivacyItemId;
	label: string;
	question: string;
	options: PrivacyAudience[];
	everyoneNote: string;
	restrictedNote: string;
	exceptionLabels: Record<PrivacyException, string>;
}

export interface PrivacySection {
	id: string;
	title: string;
	items: PrivacyItem[];
}

const showExceptions: Record<PrivacyException, string> = {
	always: 'Всегда показывать',
	never: 'Никогда не показывать'
};

const allowExceptions: Record<PrivacyException, string> = {
	always: 'Всегда разрешать',
	never: 'Никогда не разрешать'
};

const visibilityOptions: PrivacyAudience[] = ['everyone', 'friends', 'nobody'];

export const privacySections: PrivacySection[] = [
	{
		id: 'visibility',
		title: 'Приватность',
		items: [
			{
				id: 'avatar',
				label: 'Фото профиля',
				question: 'Кто может видеть моё фото профиля?',
				options: visibilityOptions,
				everyoneNote: 'Видно всем, кто откроет ваш профиль',
				restrictedNote: 'Остальные увидят ваши инициалы',
				exceptionLabels: showExceptions
			},
			{
				id: 'description',
				label: 'Описание',
				question: 'Кто может видеть моё описание?',
				options: visibilityOptions,
				everyoneNote: 'Видно всем, кто откроет ваш профиль',
				restrictedNote: 'Остальные не увидят раздел «О себе»',
				exceptionLabels: showExceptions
			},
			{
				id: 'banner',
				label: 'Баннер',
				question: 'Кто может видеть мой баннер?',
				options: visibilityOptions,
				everyoneNote: 'Видно всем, кто откроет ваш профиль',
				restrictedNote: 'Остальные увидят обычный фон',
				exceptionLabels: showExceptions
			}
		]
	},
	{
		id: 'communication',
		title: 'Общение',
		items: [
			{
				id: 'friendRequests',
				label: 'Запросы в друзья',
				question: 'Кто может отправлять мне запросы в друзья?',
				options: ['everyone', 'mutualServers', 'nobody'],
				everyoneNote: 'Запрос может отправить любой пользователь',
				restrictedNote: 'Остальные не смогут отправить вам запрос',
				exceptionLabels: allowExceptions
			},
			{
				id: 'onlineStatus',
				label: 'Статус «в сети»',
				question: 'Кто видит, что я в сети?',
				options: visibilityOptions,
				everyoneNote: 'Все видят, когда вы в сети',
				restrictedNote: 'Остальные всегда будут видеть вас не в сети',
				exceptionLabels: showExceptions
			},
			{
				id: 'forwardName',
				label: 'Ник при пересылке',
				question: 'Кто видит мой ник в пересланных сообщениях?',
				options: visibilityOptions,
				everyoneNote: 'При пересылке все видят, что сообщение ваше',
				restrictedNote: 'Остальные увидят «Переслано» без ника',
				exceptionLabels: showExceptions
			},
			{
				id: 'serverInvites',
				label: 'Приглашения на серверы',
				question: 'Кто может приглашать меня на серверы?',
				options: visibilityOptions,
				everyoneNote: 'Приглашение может отправить любой пользователь',
				restrictedNote: 'Остальные не смогут отправить вам приглашение',
				exceptionLabels: allowExceptions
			}
		]
	}
];

const audienceLabels: Record<PrivacyAudience, string> = {
	everyone: 'Все',
	friends: 'Друзья',
	mutualServers: 'Участники общих серверов',
	nobody: 'Никто'
};

export const defaultAudiences: Record<PrivacyItemId, PrivacyAudience> = {
	avatar: 'everyone',
	description: 'everyone',
	banner: 'everyone',
	friendRequests: 'everyone',
	onlineStatus: 'everyone',
	forwardName: 'everyone',
	serverInvites: 'everyone'
};

export function exceptionsFor(audience: PrivacyAudience): PrivacyException[] {
	if (audience === 'everyone') return ['never'];
	if (audience === 'nobody') return ['always'];
	return ['always', 'never'];
}

export function audienceLabel(audience: PrivacyAudience): string {
	return audienceLabels[audience];
}

export function privacyItemOf(id: PrivacyItemId): PrivacyItem {
	const items = privacySections.flatMap((section) => section.items);
	return items.find((item) => item.id === id) ?? items[0];
}

export const dataPageLabels: Record<'blocked' | 'autoDelete', string> = {
	blocked: 'Заблокированные',
	autoDelete: 'Автоудаление учётной записи'
};

export function privacyPageTitle(id: PrivacyPageId): string {
	return id === 'blocked' || id === 'autoDelete' ? dataPageLabels[id] : privacyItemOf(id).label;
}

export const deletionPeriods: { months: DeletionPeriod; label: string }[] = [
	{ months: 1, label: '1 месяц' },
	{ months: 3, label: '3 месяца' },
	{ months: 6, label: '6 месяцев' },
	{ months: 12, label: '1 год' }
];

export const defaultDeletionPeriod: DeletionPeriod = 6;

export function deletionPeriodLabel(months: DeletionPeriod): string {
	return deletionPeriods.find((period) => period.months === months)?.label ?? '';
}

export function audienceNote(item: PrivacyItem, audience: PrivacyAudience): string {
	return audience === 'everyone' ? item.everyoneNote : item.restrictedNote;
}
