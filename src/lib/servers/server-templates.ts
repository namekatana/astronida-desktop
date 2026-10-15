import { createCategory, createChannel, type ChannelKind } from '$lib/channels/channels';
import type { IconName } from '$lib/ui/icons';

export type ServerTemplateId = 'custom' | 'games' | 'friends' | 'study';

interface TemplateChannel {
	kind: ChannelKind;
	name: string;
}

interface TemplateCategory {
	name: string | null;
	channels: TemplateChannel[];
}

export interface ServerTemplate {
	id: ServerTemplateId;
	label: string;
	icon: IconName;
	categories: TemplateCategory[];
}

const text = (name: string): TemplateChannel => ({ kind: 'text', name });
const voice = (name: string): TemplateChannel => ({ kind: 'voice', name });

export const serverTemplates: ServerTemplate[] = [
	{
		id: 'custom',
		label: 'Свой шаблон',
		icon: 'pencil',
		categories: [{ name: null, channels: [text('общий'), voice('Голосовой')] }]
	},
	{
		id: 'games',
		label: 'Игры',
		icon: 'gamepad',
		categories: [
			{ name: 'Информация', channels: [text('правила'), text('новости')] },
			{
				name: 'Текстовые',
				channels: [text('общий'), text('поиск-тиммейтов'), text('клипы')]
			},
			{ name: 'Голосовые', channels: [voice('Лобби'), voice('Команда 1'), voice('Команда 2')] }
		]
	},
	{
		id: 'friends',
		label: 'Друзья',
		icon: 'users',
		categories: [
			{ name: 'Текстовые', channels: [text('общий'), text('мемы'), text('планы')] },
			{ name: 'Голосовые', channels: [voice('Болталка'), voice('Игры')] }
		]
	},
	{
		id: 'study',
		label: 'Учебная группа',
		icon: 'book',
		categories: [
			{ name: 'Информация', channels: [text('объявления'), text('расписание')] },
			{ name: 'Текстовые', channels: [text('общий'), text('домашка'), text('материалы')] },
			{ name: 'Голосовые', channels: [voice('Учебная'), voice('Консультации')] }
		]
	}
];

export async function applyServerTemplate(serverId: string, template: ServerTemplate) {
	for (const category of template.categories) {
		const categoryId = await categoryIdFor(serverId, category.name);
		if (categoryId === undefined) continue;
		for (const channel of category.channels) {
			await createChannel({ serverId, categoryId, name: channel.name, kind: channel.kind });
		}
	}
}

async function categoryIdFor(serverId: string, name: string | null) {
	if (name === null) return null;
	const result = await createCategory(serverId, name);
	return result.ok ? result.value.id : undefined;
}
