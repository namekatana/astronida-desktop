import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

export type ChannelKind = 'text' | 'voice';

export interface Category {
	id: string;
	serverId: string;
	name: string;
	position: number;
}

export interface Channel {
	id: string;
	serverId: string;
	categoryId: string | null;
	name: string;
	kind: ChannelKind;
	position: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export const nameMaxLength = 40;

export function validateName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) return 'Введите название';
	if (trimmed.length > nameMaxLength) return `Не длиннее ${nameMaxLength} символов`;
	return '';
}

function toKind(raw: string): ChannelKind {
	return raw === 'voice' ? 'voice' : 'text';
}

export async function loadChannels(
	serverId: string
): Promise<{ categories: Category[]; channels: Channel[] }> {
	const [categoriesResult, channelsResult] = await Promise.all([
		retryOnFreshToken(() =>
			supabase
				.from('categories')
				.select('id, server_id, name, position')
				.eq('server_id', serverId)
				.order('position')
				.order('created_at')
		),
		retryOnFreshToken(() =>
			supabase
				.from('channels')
				.select('id, server_id, category_id, name, kind, position')
				.eq('server_id', serverId)
				.order('position')
				.order('created_at')
		)
	]);

	return {
		categories: (categoriesResult.data ?? []).map((row) => ({
			id: row.id,
			serverId: row.server_id,
			name: row.name,
			position: row.position
		})),
		channels: (channelsResult.data ?? []).map((row) => ({
			id: row.id,
			serverId,
			categoryId: row.category_id,
			name: row.name,
			kind: toKind(row.kind),
			position: row.position
		}))
	};
}

export async function createCategory(
	serverId: string,
	name: string,
	position: number
): Promise<Result<Category>> {
	const { data, error } = await supabase
		.from('categories')
		.insert({ server_id: serverId, name: name.trim(), position })
		.select('id, server_id, name, position')
		.single();

	if (error?.message === 'limit_reached') {
		return { ok: false, message: 'Достигнут лимит: не больше 50 категорий на сервере' };
	}
	if (error || !data) {
		return { ok: false, message: 'Не удалось создать категорию, попробуйте ещё раз' };
	}
	return {
		ok: true,
		value: { id: data.id, serverId: data.server_id, name: data.name, position: data.position }
	};
}

export async function createChannel(input: {
	serverId: string;
	categoryId: string | null;
	name: string;
	kind: ChannelKind;
	position: number;
}): Promise<Result<Channel>> {
	const { data, error } = await supabase
		.from('channels')
		.insert({
			server_id: input.serverId,
			category_id: input.categoryId,
			name: input.name.trim(),
			kind: input.kind,
			position: input.position
		})
		.select('id, server_id, category_id, name, kind, position')
		.single();

	if (error?.message === 'limit_reached') {
		return { ok: false, message: 'Достигнут лимит: не больше 500 каналов на сервере' };
	}
	if (error || !data) {
		return { ok: false, message: 'Не удалось создать канал, попробуйте ещё раз' };
	}
	return {
		ok: true,
		value: {
			id: data.id,
			serverId: input.serverId,
			categoryId: data.category_id,
			name: data.name,
			kind: toKind(data.kind),
			position: data.position
		}
	};
}
