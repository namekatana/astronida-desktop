import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { resetAccount } from '$lib/auth/account-reset';
import { signOut } from '$lib/auth/auth';
import {
	workspaceCache,
	type CachedAccount,
	type WorkspaceCache
} from '$lib/cache/workspace-cache';
import type { Category, Channel } from '$lib/channels/channels';
import { createConversations } from '$lib/direct/conversations.svelte';
import type { Friend } from '$lib/friends/friends';
import { createFriendsState } from '$lib/friends/friends-state.svelte';
import { history, type HistoryPage } from '$lib/history/history';
import { inviteLinkOf, joinByInvite, forgetServerInvites } from '$lib/invites/invites';
import type { MemberListPreview } from '$lib/members/member-list.svelte';
import type { Member } from '$lib/members/members';
import type { CompressedImage } from '$lib/media/compress';
import { warmImageIndex } from '$lib/media/images';
import { createFeeds } from '$lib/messages/feeds.svelte';
import type MessageComposer from '$lib/messages/MessageComposer.svelte';
import { createMessageMenu } from '$lib/messages/message-menu.svelte';
import { createOpenChat } from '$lib/messages/open-chat.svelte';
import { createPins } from '$lib/messages/pins.svelte';
import { createSending } from '$lib/messages/sending.svelte';
import { createIncoming } from '$lib/notifications/incoming.svelte';
import { unread } from '$lib/notifications/unread.svelte';
import { watchMembers } from '$lib/presence/presence';
import { createServersPresence } from '$lib/presence/servers-presence.svelte';
import { knownAvatars } from '$lib/profile/known-avatars.svelte';
import type { ProfileTarget } from '$lib/profile/profile';
import { profileDetails } from '$lib/profile/profile-details.svelte';
import { widgetsFrom, type ProfileWidget } from '$lib/profile/widgets/widgets';
import type { Server } from '$lib/servers/servers';
import { createWorkspaces } from '$lib/servers/workspaces.svelte';
import { createSync } from '$lib/sync/sync';
import { connection } from '$lib/realtime/connection.svelte';
import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
import { lastSelection } from '$lib/ui/last-selection.svelte';
import { toast } from '$lib/ui/toast.svelte';
import { createVoiceOccupants } from '$lib/voice/occupants.svelte';
import { voice } from '$lib/voice/voice.svelte';
import type { Overlays } from './overlays.svelte';

export interface AppData {
	userId: string;
	account: CachedAccount;
	refresh: Promise<CachedAccount>;
	cache: WorkspaceCache;
	initialChat: { channelId: string; page: HistoryPage } | null;
}

export type AppState = ReturnType<typeof createAppState>;

type Composer = ReturnType<typeof MessageComposer>;

const presenceStampMs = 30_000;

export function createAppState(input: { data: AppData; overlays: Overlays }) {
	const { data, overlays } = input;

	let servers = $state<Server[]>(data.account.servers);
	let username = $state<string | null>(data.account.username);
	let displayName = $state<string | null>(data.account.displayName ?? null);
	let avatarId = $state<string | null>(data.account.avatarId ?? null);
	profileDetails.set(data.userId, {
		bannerId: data.account.bannerId ?? null,
		bio: data.account.bio ?? null,
		widgets: widgetsFrom(data.account.widgets ?? null) ?? null
	});
	let selectedServerId = $state<string | null>(
		data.account.servers.some((server) => server.id === lastSelection.serverId)
			? lastSelection.serverId
			: null
	);
	let selectedChannelId = $state<string | null>(null);
	let selectedFriendId = $state<string | null>(lastSelection.friendId);
	let signingOut = $state(false);
	let composer = $state<Composer>();

	const workspaces = createWorkspaces({
		userId: data.userId,
		initial: data.cache.workspaces,
		servers: () => servers
	});
	const workspace = $derived(selectedServerId ? workspaces.all[selectedServerId] : undefined);
	const categories = $derived(workspace?.categories ?? []);
	const channels = $derived(workspace?.channels ?? []);
	const memberPreviews: Record<string, MemberListPreview> = { ...data.cache.memberPreviews };

	function saveMemberPreview(serverId: string, preview: MemberListPreview) {
		memberPreviews[serverId] = preview;
		workspaceCache.saveMemberPreview(data.userId, serverId, preview);
	}

	function stampLivePresence() {
		const status = connection.status;
		if (status !== 'ready' && status !== 'updating') return;
		workspaceCache.markPresenceLive(data.userId, selectedServerId);
	}

	function savePresenceOnLeave() {
		stampLivePresence();
		workspaceCache.flush();
	}

	$effect(() => {
		const timer = setInterval(stampLivePresence, presenceStampMs);
		return () => clearInterval(timer);
	});

	const channelsLoading = $derived(selectedServerId !== null && workspace === undefined);
	const chatSkeleton = createDelayedFlag(() => channelsLoading);

	const feeds = createFeeds();
	if (data.initialChat) feeds.seed(data.initialChat.channelId, data.initialChat.page);
	const sync = createSync(feeds);

	$effect(() => {
		warmImageIndex();
	});

	const friends = createFriendsState({
		userId: data.userId,
		friends: data.account.friends ?? [],
		online: data.cache.friendsOnline,
		feeds,
		persist: (list) => persistAccount(list),
		onRemoved: (friend) => {
			if (friend.channelId) conversations.remember(friend);
		}
	});

	const conversations = createConversations({
		userId: data.userId,
		initial: data.account.conversations ?? [],
		feeds,
		friendIds: () => friends.ids,
		persist: () => persistAccount(friends.list)
	});

	const selectedServer = $derived(servers.find((server) => server.id === selectedServerId) ?? null);
	const selectedChannel = $derived(channels.find((c) => c.id === selectedChannelId) ?? null);
	const selectedFriend = $derived.by((): (Friend & Member) | null => {
		if (selectedServer || !selectedFriendId) return null;
		const friend = friends.withPresence.find((known) => known.id === selectedFriendId);
		if (friend) return friend;
		const partner = conversations.find(selectedFriendId);
		return partner ? { ...partner, online: false, owner: false } : null;
	});
	const openChatId = $derived(selectedChannel?.id ?? selectedFriend?.channelId ?? null);

	const orderedChannels = $derived.by(() => {
		const withoutCategory = channels.filter((c) => c.categoryId === null);
		const byCategory = categories.flatMap((category) =>
			channels.filter((c) => c.categoryId === category.id)
		);
		return [...withoutCategory, ...byCategory];
	});

	$effect(() => {
		data.refresh.then((account) => {
			servers = account.servers;
			username = account.username;
			displayName = account.displayName ?? null;
			avatarId = account.avatarId ?? null;
			knownAvatars.learn(data.userId, avatarId);
			profileDetails.set(data.userId, {
				bannerId: account.bannerId ?? null,
				bio: account.bio ?? null,
				widgets: widgetsFrom(account.widgets ?? null) ?? null
			});
			friends.list = account.friends;
			conversations.list = account.conversations ?? [];
		});
	});

	$effect(() => {
		const server = selectedServer;
		const current = workspace;
		lastSelection.serverId = server?.id ?? null;
		if (!server || !current) {
			selectedChannelId = null;
			return;
		}
		untrack(() => {
			if (current.channels.some((c) => c.id === selectedChannelId)) return;
			const remembered = current.channels.find((c) => c.id === lastSelection.channelFor(server.id));
			const rememberedVisible =
				remembered && (remembered.kind === 'text' || voice.connected?.channelId === remembered.id);
			selectedChannelId =
				(rememberedVisible ? remembered.id : null) ?? firstTextChannel()?.id ?? null;
		});
	});

	$effect(() => {
		watchMembers(selectedServerId);
		return () => watchMembers(null);
	});

	$effect(() => {
		if (selectedServerId && selectedChannelId) {
			lastSelection.setChannel(selectedServerId, selectedChannelId);
		}
	});

	const presence = createServersPresence({
		userId: data.userId,
		initial: data.cache.presence,
		serverIds: () => servers.map((server) => server.id),
		onChannelMessage: (serverId, channelId, message) =>
			incoming.handleChannelMessage(serverId, channelId, message),
		onChannelActivity: (serverId, activity) => incoming.handleChannelActivity(serverId, activity),
		onCategoryCreated: workspaces.addCategory,
		onChannelCreated: workspaces.addChannel,
		onMessageDeleted: sync.forget,
		onMessageEdited: sync.edit,
		onRemoved: leaveRemovedServer
	});

	const occupants = createVoiceOccupants({
		userId: data.userId,
		presence,
		ownerOf: (serverId) => servers.find((server) => server.id === serverId)?.ownerId ?? null,
		selfProfile: () => ({
			username: username ?? '',
			name: displayName ?? username ?? '',
			avatarId
		}),
		selectedServerId: () => selectedServerId
	});

	const openChat = createOpenChat({ userId: data.userId, feeds, sync, chatId: () => openChatId });

	const pins = createPins({ chatId: () => openChatId, sync });
	const canPin = $derived(
		selectedChannel ? selectedServer?.ownerId === data.userId : selectedFriend !== null
	);
	const canDeleteOthers = $derived(
		selectedChannel !== null && selectedServer?.ownerId === data.userId
	);

	const menu = createMessageMenu({ chatId: () => openChatId, sync });

	const incoming = createIncoming({
		userId: data.userId,
		sync,
		openChatId: () => openChatId,
		isTextChannel: workspaces.isTextChannel,
		requestCount: () => friends.requests.length,
		onOpenHome: openHome,
		onDirectMessage: (channelId, message) => {
			if (friends.list.some((friend) => friend.channelId === channelId)) return;
			conversations.learnFromMessage(channelId, message.author);
		},
		onAvatarChanged: (next) => {
			if (next !== avatarId) changeAvatar(next);
		},
		onProfileChanged: (changes) => {
			profileDetails.set(data.userId, changes);
			persistAccount(friends.list);
		}
	});

	function selfProfile(): ProfileTarget {
		const ownName = username ?? '';
		return { id: data.userId, username: ownName, name: displayName ?? ownName, avatarId };
	}

	const sending = createSending({ feeds, author: selfProfile });

	$effect(() => {
		void openChatId;
		untrack(() => {
			overlays.close('photo-viewer');
			overlays.close('send-photos');
		});
	});

	const unreadServerIds = $derived.by(() => {
		const unreadChannels = new Set(unread.channelIds);
		return new Set(
			servers
				.filter((server) =>
					workspaces.all[server.id]?.channels.some((channel) => unreadChannels.has(channel.id))
				)
				.map((server) => server.id)
		);
	});

	function persistAccount(list: Friend[]) {
		const details = profileDetails.of(data.userId);
		workspaceCache.saveAccount(data.userId, {
			username,
			displayName,
			avatarId,
			bannerId: details.bannerId,
			bio: details.bio,
			widgets: details.widgets,
			servers,
			friends: list,
			conversations: conversations.list
		});
	}

	function changeAvatar(next: string | null) {
		avatarId = next;
		knownAvatars.learn(data.userId, next);
		persistAccount(friends.list);
	}

	function changeBanner(next: string | null) {
		profileDetails.set(data.userId, { bannerId: next });
		persistAccount(friends.list);
	}

	function changeBio(next: string | null) {
		profileDetails.set(data.userId, { bio: next });
		persistAccount(friends.list);
	}

	function changeWidgets(next: ProfileWidget[] | null) {
		profileDetails.set(data.userId, { widgets: next });
		persistAccount(friends.list);
	}

	function selectServer(serverId: string | null) {
		selectedServerId = serverId;
	}

	function selectFriend(friendId: string) {
		selectedFriendId = friendId;
		lastSelection.friendId = friendId;
	}

	function closeDirectChat() {
		if (!selectedFriend) return;
		selectedFriendId = null;
		lastSelection.friendId = null;
	}

	function openHome(directChannelId: string | null) {
		selectedServerId = null;
		if (!directChannelId) return;
		const partner =
			friends.list.find((known) => known.channelId === directChannelId) ??
			conversations.findByChannel(directChannelId);
		if (partner) selectFriend(partner.id);
	}

	function chatPartner(userId: string): Friend | undefined {
		return friends.list.find((friend) => friend.id === userId) ?? conversations.find(userId);
	}

	function prefetchFriend(friendId: string) {
		const channelId = chatPartner(friendId)?.channelId;
		if (channelId) void sync.warm(channelId);
	}

	function showDirectChat(userId: string) {
		selectedServerId = null;
		selectFriend(userId);
	}

	function prefetchChannel(channelId: string) {
		const channel = channels.find((c) => c.id === channelId);
		if (channel?.kind === 'text') void sync.warm(channelId);
		else if (channel?.kind === 'voice' && selectedServerId) voice.prefetch(selectedServerId);
	}

	function handleServerCreated(server: Server) {
		servers.push(server);
		selectedServerId = server.id;
		overlays.close('add-server');
	}

	function handleServerJoined(server: Server) {
		if (!servers.some((known) => known.id === server.id)) servers.push(server);
		selectedServerId = server.id;
		overlays.close('add-server');
	}

	function leaveRemovedServer(serverId: string) {
		const server = servers.find((known) => known.id === serverId);
		if (!server) return;
		const channelIds = workspaces.all[serverId]?.channels.map((channel) => channel.id) ?? [];
		if (voice.connected?.serverId === serverId) voice.disconnect();
		servers = servers.filter((known) => known.id !== serverId);
		if (selectedServerId === serverId) selectedServerId = null;
		if (overlays.find('member-menu')?.request.serverId === serverId) overlays.close('member-menu');
		if (overlays.find('moderation')?.serverId === serverId) overlays.close('moderation');
		if (overlays.find('server-settings')?.server.id === serverId) {
			overlays.close('server-settings');
		}
		workspaces.forget(serverId);
		workspaceCache.forgetServer(data.userId, serverId);
		forgetServerInvites(serverId);
		persistAccount(friends.list);
		for (const channelId of channelIds) void history.dropChannel(channelId).catch(() => {});
		toast.show(`Вы больше не участник «${server.name}»`);
	}

	const joiningInvites = new Set<string>();

	async function openInvite(code: string) {
		if (joiningInvites.has(code)) return;
		joiningInvites.add(code);
		const result = await joinByInvite(code);
		joiningInvites.delete(code);
		if (result.ok) handleServerJoined(result.server);
		else overlays.open({ kind: 'add-server', view: 'join', value: inviteLinkOf(code) });
	}

	function handleCategoryCreated(category: Category) {
		workspaces.addCategory(category);
		overlays.close('create-channel');
	}

	function handleChannelCreated(channel: Channel) {
		workspaces.addChannel(channel);
		selectedChannelId = channel.id;
		overlays.close('create-channel');
	}

	function handleSend(text: string, images: CompressedImage[] = [], spoiler = false) {
		const channelId = openChatId;
		if (!channelId || !username) return;
		openChat.resetTyping();
		sending.send(channelId, text, menu.reply ?? undefined, images, spoiler);
		menu.clearReply();
	}

	async function signOutOfAccount() {
		signingOut = true;
		sending.close();
		voice.disconnect();
		await signOut();
		workspaceCache.clear(data.userId);
		await history.clear().catch(() => {});
		signingOut = false;
		await goto('/');
		resetAccount();
	}

	function selectChannel(channelId: string) {
		selectedChannelId = channelId;
		const channel = channels.find((c) => c.id === channelId);
		if (selectedServer && channel?.kind === 'voice') {
			voice.connect({
				serverId: selectedServer.id,
				serverName: selectedServer.name,
				channelId: channel.id,
				channelName: channel.name
			});
		}
	}

	function firstTextChannel() {
		return orderedChannels.find((c) => c.kind === 'text') ?? null;
	}

	function handleVoiceDisconnect() {
		if (selectedChannel?.kind !== 'voice') return;
		selectedChannelId = firstTextChannel()?.id ?? null;
	}

	return {
		userId: data.userId,
		get servers() {
			return servers;
		},
		get username() {
			return username;
		},
		get avatarId() {
			return avatarId;
		},
		get selectedServerId() {
			return selectedServerId;
		},
		get selectedChannelId() {
			return selectedChannelId;
		},
		get selectedFriendId() {
			return selectedFriendId;
		},
		get selectedServer() {
			return selectedServer;
		},
		get selectedChannel() {
			return selectedChannel;
		},
		get selectedFriend() {
			return selectedFriend;
		},
		get openChatId() {
			return openChatId;
		},
		get categories() {
			return categories;
		},
		get channels() {
			return channels;
		},
		get channelsLoading() {
			return channelsLoading;
		},
		get chatSkeleton() {
			return chatSkeleton.current;
		},
		get canPin() {
			return canPin;
		},
		get canDeleteOthers() {
			return canDeleteOthers;
		},
		get unreadServerIds() {
			return unreadServerIds;
		},
		get signingOut() {
			return signingOut;
		},
		get composer() {
			return composer;
		},
		set composer(next: Composer | undefined) {
			composer = next;
		},
		memberPreviews,
		workspaces,
		feeds,
		sync,
		friends,
		conversations,
		presence,
		occupants,
		openChat,
		pins,
		menu,
		incoming,
		sending,
		saveMemberPreview,
		savePresenceOnLeave,
		selfProfile,
		changeAvatar,
		changeBanner,
		changeBio,
		changeWidgets,
		selectServer,
		selectFriend,
		closeDirectChat,
		chatPartner,
		prefetchFriend,
		showDirectChat,
		prefetchChannel,
		handleServerCreated,
		handleServerJoined,
		openInvite,
		handleCategoryCreated,
		handleChannelCreated,
		handleSend,
		signOut: signOutOfAccount,
		selectChannel,
		handleVoiceDisconnect
	};
}
