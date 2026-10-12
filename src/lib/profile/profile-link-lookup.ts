import { searchUsers } from '$lib/friends/channel';
import type { ProfileRelation, ProfileTarget } from './profile';

export interface ProfileLinkPerson {
	target: ProfileTarget;
	relation: ProfileRelation;
}

export interface ProfileLinkHandlers {
	lookup: (username: string) => ProfileLinkPerson | null;
	open: (target: ProfileTarget, source: HTMLElement | null) => void;
}

export type ProfileLinkResult =
	{ ok: true; person: ProfileLinkPerson } | { ok: false; reason: 'not_found' | 'failed' };

const lookups = new Map<string, Promise<ProfileLinkResult>>();

async function searchByUsername(username: string): Promise<ProfileLinkResult> {
	const outcome = await searchUsers(username);
	if (!outcome.ok) return { ok: false, reason: 'failed' };
	const match = outcome.results.find((result) => result.username === username);
	if (!match) return { ok: false, reason: 'not_found' };
	return {
		ok: true,
		person: {
			target: { id: match.id, username: match.username, name: match.name },
			relation: match.relation
		}
	};
}

export function lookupProfileLink(username: string): Promise<ProfileLinkResult> {
	const pending = lookups.get(username);
	if (pending) return pending;
	const request = searchByUsername(username).then((result) => {
		if (!result.ok && result.reason === 'failed') lookups.delete(username);
		return result;
	});
	lookups.set(username, request);
	return request;
}

export function forgetProfileLinks() {
	lookups.clear();
}
