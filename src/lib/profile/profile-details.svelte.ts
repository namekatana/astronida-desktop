import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { supabase } from '$lib/supabase/client';
import { asRecord } from '$lib/ui/record';
import { widgetsFrom, type ProfileWidget } from './widgets';

export interface ProfileDetails {
	bannerId: string | null;
	bio: string | null;
	widgets: ProfileWidget[] | null;
	mutualServerIds: string[] | null;
}

const empty: ProfileDetails = { bannerId: null, bio: null, widgets: null, mutualServerIds: null };
const rereadAfterMs = 5 * 60_000;

const known = new SvelteMap<string, ProfileDetails>();
const requested = new SvelteSet<string>();
const requestedAt = new Map<string, number>();
const versions = new Map<string, number>();

const bioMaxPayloadLength = 400;

function nullableString(value: unknown, maxLength: number): string | null | undefined {
	if (value === null) return null;
	if (typeof value === 'string' && value.length > 0 && value.length <= maxLength) return value;
	return undefined;
}

export function profileChangesFrom(
	payload: unknown
): { userId: string | null; changes: Partial<Omit<ProfileDetails, 'mutualServerIds'>> } | null {
	const record = asRecord(payload);
	if (!record) return null;
	const changes: Partial<Omit<ProfileDetails, 'mutualServerIds'>> = {};
	if ('bio' in record) {
		const bio = nullableString(record.bio, bioMaxPayloadLength);
		if (bio === undefined) return null;
		changes.bio = bio;
	}
	if ('banner_id' in record) {
		const bannerId = nullableString(record.banner_id, 36);
		if (bannerId === undefined) return null;
		changes.bannerId = bannerId;
	}
	if ('widgets' in record) {
		const widgets = widgetsFrom(record.widgets);
		if (widgets === undefined) return null;
		changes.widgets = widgets;
	}
	if (Object.keys(changes).length === 0) return null;
	const userId = typeof record.user_id === 'string' ? record.user_id : null;
	return { userId, changes };
}

function bumpVersion(userId: string): number {
	const next = (versions.get(userId) ?? 0) + 1;
	versions.set(userId, next);
	return next;
}

async function fetchDetails(userId: string) {
	const version = bumpVersion(userId);
	const [{ data, error }, memberships] = await Promise.all([
		supabase.from('profiles').select('banner_id, bio, widgets').eq('id', userId).maybeSingle(),
		supabase.from('server_members').select('server_id').eq('user_id', userId)
	]);
	if (versions.get(userId) !== version) return;
	if (error || !data) {
		requested.delete(userId);
		return;
	}
	const mutualServerIds = memberships.error
		? (known.get(userId)?.mutualServerIds ?? null)
		: (memberships.data ?? []).map((row) => row.server_id);
	known.set(userId, {
		bannerId: data.banner_id,
		bio: data.bio,
		widgets: widgetsFrom(data.widgets) ?? null,
		mutualServerIds
	});
}

function load(userId: string) {
	requested.add(userId);
	requestedAt.set(userId, Date.now());
	void fetchDetails(userId).catch(() => requested.delete(userId));
}

export const profileDetails = {
	of(userId: string): ProfileDetails {
		return known.get(userId) ?? empty;
	},
	set(userId: string, details: Partial<ProfileDetails>) {
		bumpVersion(userId);
		known.set(userId, { ...(known.get(userId) ?? empty), ...details });
	},
	apply(userId: string, changes: Partial<ProfileDetails>) {
		if (known.has(userId)) profileDetails.set(userId, changes);
		else if (requested.has(userId)) load(userId);
	},
	refresh(userId: string) {
		const fresh =
			requested.has(userId) && Date.now() - (requestedAt.get(userId) ?? 0) < rereadAfterMs;
		if (!fresh) load(userId);
	},
	markStale() {
		requested.clear();
	},
	clear() {
		known.clear();
		requested.clear();
		requestedAt.clear();
		versions.clear();
	}
};
