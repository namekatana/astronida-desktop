import { failureMessage, postApi } from '$lib/realtime/api-request';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';
import { hasInvisibleCharacters, invisibleNameMessage } from '$lib/ui/visible-text';

export interface Server {
	id: string;
	name: string;
	ownerId: string;
}

export type CreateServerResult = { ok: true; server: Server } | { ok: false; message: string };

export const serverNameMaxLength = 40;

export function validateServerName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) return 'Введите название сервера';
	if (trimmed.length > serverNameMaxLength) return `Не длиннее ${serverNameMaxLength} символов`;
	if (hasInvisibleCharacters(trimmed)) return invisibleNameMessage;
	return '';
}

export async function loadServers(): Promise<Server[]> {
	const { data, error } = await retryOnFreshToken(() =>
		supabase.from('servers').select('id, name, owner_id').order('created_at', { ascending: true })
	);

	if (error || !data) return [];
	return data.map((row) => ({
		id: row.id,
		name: row.name,
		ownerId: row.owner_id
	}));
}

interface ServerRow {
	id: string;
	name: string;
	owner_id: string;
}

function isServerRow(body: unknown): body is ServerRow {
	if (typeof body !== 'object' || body === null) return false;
	const row = body as Record<string, unknown>;
	return (
		typeof row.id === 'string' && typeof row.name === 'string' && typeof row.owner_id === 'string'
	);
}

export async function createServer(name: string): Promise<CreateServerResult> {
	const response = await postApi('/servers', { name: name.trim() });
	if (response?.status === 201 && isServerRow(response.body)) {
		const row = response.body;
		return { ok: true, server: { id: row.id, name: row.name, ownerId: row.owner_id } };
	}
	return {
		ok: false,
		message: failureMessage(response, {
			limit: 'Достигнут лимит: не больше 100 своих серверов',
			failed: 'Не удалось создать сервер, попробуйте ещё раз'
		})
	};
}
