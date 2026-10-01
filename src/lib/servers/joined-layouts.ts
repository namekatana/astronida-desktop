import { categoryFrom, channelFrom, type Category, type Channel } from '$lib/channels/channels';
import { asRecord } from '$lib/ui/record';

export type ServerLayout = { categories: Category[]; channels: Channel[] };

const layouts = new Map<string, ServerLayout>();

function listOf<T>(value: unknown, parse: (row: unknown) => T | null): T[] | null {
	if (!Array.isArray(value)) return null;
	const parsed: T[] = [];
	for (const row of value) {
		const item = parse(row);
		if (!item) return null;
		parsed.push(item);
	}
	return parsed;
}

export function rememberJoinedLayout(serverId: string, body: unknown) {
	const record = asRecord(body);
	const categories = listOf(record?.categories, categoryFrom);
	const channels = listOf(record?.channels, channelFrom);
	if (categories && channels) layouts.set(serverId, { categories, channels });
}

export function takeJoinedLayout(serverId: string): ServerLayout | null {
	const layout = layouts.get(serverId) ?? null;
	layouts.delete(serverId);
	return layout;
}
