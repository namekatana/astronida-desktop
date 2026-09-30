import { failureMessage, postApi } from '$lib/realtime/api-request';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';
import { asRecord } from '$lib/ui/record';
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

export function serverFrom(body: unknown): Server | null {
	const row = asRecord(body);
	if (typeof row?.id !== 'string' || typeof row.name !== 'string') return null;
	if (typeof row.owner_id !== 'string') return null;
	return { id: row.id, name: row.name, ownerId: row.owner_id };
}

export async function createServer(name: string): Promise<CreateServerResult> {
	const response = await postApi('/servers', { name: name.trim() });
	const server = response?.status === 201 ? serverFrom(response.body) : null;
	if (server) return { ok: true, server };
	return {
		ok: false,
		message: failureMessage(response, {
			limit: 'Достигнут лимит: не больше 100 своих серверов',
			failed: 'Не удалось создать сервер, попробуйте ещё раз'
		})
	};
}
