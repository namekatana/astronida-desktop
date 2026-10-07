import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';
import { workspaceCache, type CachedAccount, type Workspace } from '$lib/cache/workspace-cache';
import { loadConversations } from '$lib/direct/conversations';
import { loadFriends } from '$lib/friends/friends';
import { history, type HistoryPage } from '$lib/history/history';
import { lastSelection } from '$lib/ui/last-selection.svelte';
import { restorePinned } from '$lib/messages/pins-cache';
import { preloadAvatars, type AvatarVariant } from '$lib/profile/avatar-images';
import { preloadBanner } from '$lib/profile/banner-images';
import { restoreInvitePreviews } from '$lib/servers/invites';
import type { MemberListPreview } from '$lib/servers/member-list.svelte';
import { loadServers } from '$lib/servers/servers';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

async function fetchAccount(userId: string): Promise<CachedAccount> {
	const [profile, servers, friends, conversations] = await Promise.all([
		retryOnFreshToken(() =>
			supabase
				.from('profiles')
				.select('username, display_name, avatar_id, banner_id, bio, widgets')
				.eq('id', userId)
				.single()
		),
		loadServers(),
		loadFriends(userId),
		loadConversations(userId)
	]);
	const account = {
		username: profile.data?.username ?? null,
		displayName: profile.data?.display_name ?? null,
		avatarId: profile.data?.avatar_id ?? null,
		bannerId: profile.data?.banner_id ?? null,
		bio: profile.data?.bio ?? null,
		widgets: profile.data?.widgets ?? null,
		servers,
		friends,
		conversations
	};
	workspaceCache.saveAccount(userId, account);
	return account;
}

function lastOpenChatId(
	account: CachedAccount,
	workspaces: Record<string, Workspace>
): string | null {
	const serverId = lastSelection.serverId;
	if (serverId && account.servers.some((server) => server.id === serverId)) {
		const channelId = lastSelection.channelFor(serverId);
		const channel = workspaces[serverId]?.channels.find((candidate) => candidate.id === channelId);
		return channel?.kind === 'text' ? channel.id : null;
	}
	const partners = [...(account.friends ?? []), ...(account.conversations ?? [])];
	const partner = partners.find((candidate) => candidate.id === lastSelection.friendId);
	return partner?.channelId ?? null;
}

const avatarPreloadLimitMs = 300;

function visibleAvatars(
	account: CachedAccount,
	previews: Record<string, MemberListPreview>
): { avatarId: string; variant: AvatarVariant }[] {
	const serverId = lastSelection.serverId;
	const members = serverId ? (previews[serverId]?.rows ?? []) : [];
	const people = [...(account.friends ?? []), ...(account.conversations ?? []), ...members];
	const others = people.flatMap((person) =>
		person.avatarId ? [{ avatarId: person.avatarId, variant: 'small' as const }] : []
	);
	const own = account.avatarId
		? [
				{ avatarId: account.avatarId, variant: 'small' as const },
				{ avatarId: account.avatarId, variant: 'large' as const }
			]
		: [];
	return [...own, ...others];
}

function preloadVisibleAvatars(
	account: CachedAccount,
	previews: Record<string, MemberListPreview>
): Promise<void> {
	return Promise.race([
		Promise.all([
			preloadAvatars(visibleAvatars(account, previews)),
			account.bannerId ? preloadBanner(account.bannerId) : undefined
		]).then(() => {}),
		new Promise<void>((resolve) => setTimeout(resolve, avatarPreloadLimitMs))
	]);
}

async function readInitialChat(
	account: CachedAccount,
	workspaces: Record<string, Workspace>
): Promise<{ channelId: string; page: HistoryPage } | null> {
	const channelId = lastOpenChatId(account, workspaces);
	if (!channelId) return null;
	const page = await history.page(channelId).catch(() => null);
	return page ? { channelId, page } : null;
}

export async function load() {
	const user = auth.user;
	if (!user) {
		redirect(307, '/');
	}

	await history.open(user.id).catch(() => {});
	const [cache] = await Promise.all([
		workspaceCache.read(user.id),
		restoreInvitePreviews(),
		restorePinned()
	]);
	const refresh = fetchAccount(user.id);
	const account = cache.account ?? (await refresh);
	const [initialChat] = await Promise.all([
		readInitialChat(account, cache.workspaces),
		preloadVisibleAvatars(account, cache.memberPreviews)
	]);

	return { userId: user.id, account, refresh, cache, initialChat };
}
