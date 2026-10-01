import type { Channel } from 'phoenix';
import { presenceStatusFrom, type PresenceStatus } from '$lib/presence/status';
import { pushTo, type PushOutcome } from '$lib/realtime/push';
import { phoenixSocket } from '$lib/realtime/socket';
import type { Friend, FriendRelation, UserSearchResult } from './friends';

interface ProfilePayload {
	id: string;
	username: string;
	display_name: string;
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
}

export type SearchOutcome =
	{ ok: true; results: UserSearchResult[] } | { ok: false; reason: 'rate_limited' | 'failed' };

interface FriendsSession {
	channel: Channel;
	dropRequest: (userId: string) => void;
}

let session: FriendsSession | null = null;

function toFriend(profile: ProfilePayload, channelId: string | null = null): Friend {
	return { id: profile.id, username: profile.username, name: profile.display_name, channelId };
}

export function subscribeToFriends(input: {
	userId: string;
	onOnline: (online: Map<string, PresenceStatus>) => void;
	onRequests: (requests: Friend[]) => void;
	onRequestReceived: (request: Friend) => void;
	onFriendAdded: (friend: Friend) => void;
}): () => void {
	const channel = phoenixSocket().channel(`friends:${input.userId}`);
	let online = new Map<string, PresenceStatus>();
	let requests: Friend[] = [];

	const publishOnline = () => input.onOnline(new Map(online));
	const publishRequests = () => input.onRequests([...requests]);

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
		publishOnline();
		input.onFriendAdded(friend);
	});
	channel.join().receive('ok', (reply: JoinReply) => {
		online = new Map(
			reply.online.map((userId) => [userId, presenceStatusFrom(reply.statuses?.[userId])])
		);
		requests = reply.incoming.map((profile) => toFriend(profile));
		publishOnline();
		publishRequests();
	});

	session = { channel, dropRequest };

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

export async function sendFriendRequest(userId: string): Promise<FriendRelation | null> {
	const outcome = await push<{ relation: FriendRelation }>('request', { user_id: userId });
	return outcome.ok ? outcome.reply.relation : null;
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
