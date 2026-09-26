import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

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

export async function createServer(name: string, ownerId: string): Promise<CreateServerResult> {
	const { data, error } = await supabase
		.from('servers')
		.insert({ name: name.trim(), owner_id: ownerId })
		.select('id, name, owner_id')
		.single();

	if (error?.message === 'limit_reached') {
		return { ok: false, message: 'Достигнут лимит: не больше 100 своих серверов' };
	}
	if (error || !data) {
		return {
			ok: false,
			message: 'Не удалось создать сервер, попробуйте ещё раз'
		};
	}
	return {
		ok: true,
		server: { id: data.id, name: data.name, ownerId: data.owner_id }
	};
}
