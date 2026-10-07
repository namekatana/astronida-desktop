import type { Channel } from 'phoenix';
import { presenceStatusFrom, type PresenceStatus } from '$lib/presence/status';
import { knownAvatars } from '$lib/profile/known-avatars.svelte';
import { profileChangesFrom, profileDetails } from '$lib/profile/profile-details.svelte';
import { pushTo, type PushOutcome } from '$lib/realtime/push';
import { phoenixSocket } from '$lib/realtime/socket';
import type { Friend, FriendRelation, UserSearchResult } from './friends';

interface ProfilePayload {
	id: string;
	username: string;
	display_name: string;
	avatar_id?: string | null;
}

interface SearchResultPayload extends ProfilePayload {
	relation: FriendRelation;
}

interface FriendAddedPayload {
	user: ProfilePayload;
	channel_id: string | null;
	online: boolean;
	status?: unknown;
}

interface JoinReply {
	online: string[];
	statuses?: Record<string, unknown>;
	incoming: ProfilePayload[];
	outgoing?: string[];
}

export type SearchOutcome =
	{ ok: true; results: UserSearchResult[] } | { ok: false; reason: 'rate_limited' | 'failed' };

interface FriendsSession {
	channel: Channel;
	dropRequest: (userId: string) => void;
	markOutgoing: (userId: string) => void;
}

let session: FriendsSession | null = null;

function toFriend(profile: ProfilePayload, channelId: string | null = null): Friend {
	const avatarId = typeof profile.avatar_id === 'string' ? profile.avatar_id : null;
	knownAvatars.learn(profile.id, avatarId);
	return {
		id: profile.id,
		username: profile.username,
		name: profile.display_name,
		avatarId,
		channelId
	};
}

export function subscribeToFriends(input: {
	userId: string;
	onOnline: (online: Map<string, PresenceStatus>) => void;
	onRequests: (requests: Friend[]) => void;
	onRequestReceived: (request: Friend) => void;
	onFriendAdded: (friend: Friend) => void;
	onFriendAvatar: (userId: string, avatarId: string | null) => void;
	onOutgoing: (userIds: Set<string>) => void;
}): () => void {
	const channel = phoenixSocket().channel(`friends:${input.userId}`);
	let online = new Map<string, PresenceStatus>();
	let requests: Friend[] = [];
	let outgoing = new Set<string>();

	const publishOnline = () => input.onOnline(new Map(online));
	const publishRequests = () => input.onRequests([...requests]);
	const publishOutgoing = () => input.onOutgoing(new Set(outgoing));

	function markOutgoing(userId: string) {
		if (outgoing.has(userId)) return;
		outgoing.add(userId);
		publishOutgoing();
	}

	function dropOutgoing(userId: string) {
		if (outgoing.delete(userId)) publishOutgoing();
	}

	function markPresence(userId: string, isOnline: boolean, status: unknown) {
		if (isOnline) online.set(userId, presenceStatusFrom(status));
		else online.delete(userId);
	}

	function dropRequest(userId: string) {
		if (!requests.some((request) => request.id === userId)) return;
		requests = requests.filter((request) => request.id !== userId);
		publishRequests();
	}

	channel.on(
		'friend_presence',
		(payload: { user_id: string; online: boolean; status?: unknown }) => {
			markPresence(payload.user_id, payload.online, payload.status);
			publishOnline();
		}
	);
	channel.on('friend_request', (payload: { user: ProfilePayload }) => {
		const request = toFriend(payload.user);
		const known = requests.some((existing) => existing.id === request.id);
		requests = [...requests.filter((existing) => existing.id !== request.id), request];
		publishRequests();
		if (!known) input.onRequestReceived(request);
	});
	channel.on('friend_added', (payload: FriendAddedPayload) => {
		const friend = toFriend(payload.user, payload.channel_id);
		markPresence(friend.id, payload.online, payload.status);
		dropRequest(friend.id);
		dropOutgoing(friend.id);
		publishOnline();
		input.onFriendAdded(friend);
	});
	channel.on('friend_avatar', (payload: { user_id: string; avatar_id: string | null }) => {
		knownAvatars.learn(payload.user_id, payload.avatar_id ?? null);
		input.onFriendAvatar(payload.user_id, payload.avatar_id ?? null);
	});
	channel.on('friend_profile', (payload: unknown) => {
		const update = profileChangesFrom(payload);
		if (update?.userId) profileDetails.apply(update.userId, update.changes);
	});
	channel.join().receive('ok', (reply: JoinReply) => {
		online = new Map(
			reply.online.map((userId) => [userId, presenceStatusFrom(reply.statuses?.[userId])])
		);
		requests = reply.incoming.map((profile) => toFriend(profile));
		outgoing = new Set(reply.outgoing ?? []);
		publishOnline();
		publishRequests();
		publishOutgoing();
	});

	session = { channel, dropRequest, markOutgoing };

	return () => {
		if (session?.channel === channel) session = null;
		channel.leave();
	};
}

function push<T>(event: string, payload: object): Promise<PushOutcome<T>> {
	const channel = session?.channel;
	if (!channel) return Promise.resolve({ ok: false, reason: 'offline' });
	return pushTo<T>(channel, event, payload);
}

export async function searchUsers(query: string): Promise<SearchOutcome> {
	const outcome = await push<{ results: SearchResultPayload[] }>('search', { query });
	if (!outcome.ok) {
		return { ok: false, reason: outcome.reason === 'rate_limited' ? 'rate_limited' : 'failed' };
	}
	return {
		ok: true,
		results: outcome.reply.results.map((result) => ({
			...toFriend(result),
			relation: result.relation
		}))
	};
}

export type FriendRequestOutcome =
	| { ok: true; relation: FriendRelation }
	| { ok: false; reason: 'limit_reached' | 'rate_limited' | 'not_found' | 'failed' };

export const friendRequestFailureText: Record<
	Extract<FriendRequestOutcome, { ok: false }>['reason'],
	string
> = {
	limit_reached: 'Слишком много отправленных запросов',
	rate_limited: 'Слишком часто, попробуйте через минуту',
	not_found: 'Пользователь не найден',
	failed: 'Не удалось отправить — проверьте соединение'
};

export async function requestFriendship(userId: string): Promise<FriendRequestOutcome> {
	const outcome = await push<{ relation: FriendRelation }>('request', { user_id: userId });
	if (!outcome.ok) {
		const known = ['limit_reached', 'rate_limited', 'not_found'] as const;
		const reason = known.find((candidate) => candidate === outcome.reason) ?? 'failed';
		return { ok: false, reason };
	}
	if (outcome.reply.relation === 'outgoing') session?.markOutgoing(userId);
	return { ok: true, relation: outcome.reply.relation };
}

export async function sendFriendRequest(userId: string): Promise<FriendRelation | null> {
	const outcome = await requestFriendship(userId);
	return outcome.ok ? outcome.relation : null;
}

export async function acceptFriendRequest(userId: string): Promise<boolean> {
	const outcome = await push<unknown>('accept', { user_id: userId });
	return outcome.ok;
}

export async function declineFriendRequest(userId: string): Promise<boolean> {
	const outcome = await push<unknown>('decline', { user_id: userId });
	if (outcome.ok) session?.dropRequest(userId);
	return outcome.ok;
}
