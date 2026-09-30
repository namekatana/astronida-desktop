import { failureMessage, postApi } from '$lib/realtime/api-request';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';
import { asRecord } from '$lib/ui/record';
import { hasInvisibleCharacters, invisibleNameMessage } from '$lib/ui/visible-text';

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

export const nameMaxLength = 32;

export function validateName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) return 'Введите название';
	if (trimmed.length > nameMaxLength) return `Не длиннее ${nameMaxLength} символов`;
	if (hasInvisibleCharacters(trimmed)) return invisibleNameMessage;
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

export function categoryFrom(body: unknown): Category | null {
	const row = asRecord(body);
	if (
		!row ||
		typeof row.id !== 'string' ||
		typeof row.server_id !== 'string' ||
		typeof row.name !== 'string' ||
		typeof row.position !== 'number'
	) {
		return null;
	}
	return { id: row.id, serverId: row.server_id, name: row.name, position: row.position };
}

export function channelFrom(body: unknown): Channel | null {
	const row = asRecord(body);
	if (
		!row ||
		typeof row.id !== 'string' ||
		typeof row.server_id !== 'string' ||
		(row.category_id !== null && typeof row.category_id !== 'string') ||
		typeof row.name !== 'string' ||
		(row.kind !== 'text' && row.kind !== 'voice') ||
		typeof row.position !== 'number'
	) {
		return null;
	}
	return {
		id: row.id,
		serverId: row.server_id,
		categoryId: row.category_id,
		name: row.name,
		kind: row.kind,
		position: row.position
	};
}

export async function createCategory(serverId: string, name: string): Promise<Result<Category>> {
	const response = await postApi(`/servers/${encodeURIComponent(serverId)}/categories`, {
		name: name.trim()
	});
	const category = response?.status === 201 ? categoryFrom(response.body) : null;
	if (category) return { ok: true, value: category };
	return {
		ok: false,
		message: failureMessage(response, {
			limit: 'Достигнут лимит: не больше 50 категорий на сервере',
			failed: 'Не удалось создать категорию, попробуйте ещё раз'
		})
	};
}

export async function createChannel(input: {
	serverId: string;
	categoryId: string | null;
	name: string;
	kind: ChannelKind;
}): Promise<Result<Channel>> {
	const response = await postApi(`/servers/${encodeURIComponent(input.serverId)}/channels`, {
		name: input.name.trim(),
		kind: input.kind,
		category_id: input.categoryId
	});
	const channel = response?.status === 201 ? channelFrom(response.body) : null;
	if (channel) return { ok: true, value: channel };
	return {
		ok: false,
		message: failureMessage(response, {
			limit: 'Достигнут лимит: не больше 500 каналов на сервере',
			failed: 'Не удалось создать канал, попробуйте ещё раз'
		})
	};
}
