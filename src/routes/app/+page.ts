import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth/session.svelte';
import { workspaceCache, type CachedAccount, type Workspace } from '$lib/cache/workspace-cache';
import { loadFriends } from '$lib/friends/friends';
import { history, type HistoryPage } from '$lib/history/history';
import { lastSelection } from '$lib/ui/last-selection.svelte';
import { restorePinned } from '$lib/messages/pins-cache';
import { restoreInvitePreviews } from '$lib/servers/invites';
import { loadServers } from '$lib/servers/servers';
import { supabase } from '$lib/supabase/client';
import { retryOnFreshToken } from '$lib/supabase/retry';

async function fetchAccount(userId: string): Promise<CachedAccount> {
	const [profile, servers, friends] = await Promise.all([
		retryOnFreshToken(() =>
			supabase.from('profiles').select('username').eq('id', userId).single()
		),
		loadServers(),
		loadFriends(userId)
	]);
	const account = { username: profile.data?.username ?? null, servers, friends };
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
	const friend = (account.friends ?? []).find(
		(candidate) => candidate.id === lastSelection.friendId
	);
	return friend?.channelId ?? null;
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
	const initialChat = await readInitialChat(account, cache.workspaces);

	return { userId: user.id, account, refresh, cache, initialChat };
}
