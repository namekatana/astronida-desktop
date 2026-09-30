<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth/auth';
	import { workspaceCache, type Workspace } from '$lib/cache/workspace-cache';
	import {
		loadChannels,
		type Category,
		type Channel,
		type ChannelKind
	} from '$lib/channels/channels';
	import ActiveFriendsPanel from '$lib/components/ActiveFriendsPanel.svelte';
	import AddFriendDialog from '$lib/components/AddFriendDialog.svelte';
	import AddServerDialog from '$lib/components/AddServerDialog.svelte';
	import type { AddServerView } from '$lib/components/add-server';
	import ChannelPanel from '$lib/components/ChannelPanel.svelte';
	import ChatHeader from '$lib/components/ChatHeader.svelte';
	import CreateCategoryDialog from '$lib/components/CreateCategoryDialog.svelte';
	import CreateChannelDialog from '$lib/components/CreateChannelDialog.svelte';
	import DeleteMessageDialog from '$lib/components/DeleteMessageDialog.svelte';
	import DirectChatHeader from '$lib/components/DirectChatHeader.svelte';
	import ForwardDialog from '$lib/components/ForwardDialog.svelte';
	import FriendProfile from '$lib/components/FriendProfile.svelte';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
	import HomeEmptyState from '$lib/components/HomeEmptyState.svelte';
	import InviteDialog from '$lib/components/InviteDialog.svelte';
	import MemberPanel from '$lib/components/MemberPanel.svelte';
	import MessageComposer from '$lib/components/MessageComposer.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import PinnedBar from '$lib/components/PinnedBar.svelte';
	import PinnedToggle from '$lib/components/PinnedToggle.svelte';
	import ResizeHandle from '$lib/components/ResizeHandle.svelte';
	import ServerBar from '$lib/components/ServerBar.svelte';
	import VoiceDock from '$lib/components/VoiceDock.svelte';
	import { findActiveFriends } from '$lib/friends/active-friends';
	import { acceptFriendRequest, declineFriendRequest } from '$lib/friends/channel';
	import { createFriendsState } from '$lib/friends/friends-state.svelte';
	import { history } from '$lib/history/history';
	import { createFeeds } from '$lib/messages/feeds.svelte';
	import {
		deleteMessage,
		forwardMessage,
		type DeleteFailure,
		type ForwardResult,
		type Message,
		type MessageReply
	} from '$lib/messages/messages';
	import { createOpenChat } from '$lib/messages/open-chat.svelte';
	import { createPins } from '$lib/messages/pins.svelte';
	import { createSending } from '$lib/messages/sending.svelte';
	import { typingIn } from '$lib/messages/typing.svelte';
	import { createIncoming } from '$lib/notifications/incoming.svelte';
	import { unread } from '$lib/notifications/unread.svelte';
	import { createServersPresence } from '$lib/presence/servers-presence.svelte';
	import { inviteLinkOf, joinByInvite, prefetchInviteLink } from '$lib/servers/invites';
	import { loadMembers, type JoinedMember } from '$lib/servers/members';
	import type { Server } from '$lib/servers/servers';
	import { createSync } from '$lib/sync/sync';
	import { lastSelection } from '$lib/ui/last-selection.svelte';
	import { panelLimits, panelWidths } from '$lib/ui/panel-widths.svelte';
	import { windowTitle } from '$lib/ui/title.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { createVoiceOccupants } from '$lib/voice/occupants.svelte';
	import { voice } from '$lib/voice/voice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let servers = $state<Server[]>(data.account.servers);
	// svelte-ignore state_referenced_locally
	let username = $state<string | null>(data.account.username);
	// svelte-ignore state_referenced_locally
	let selectedServerId = $state<string | null>(
		data.account.servers.some((server) => server.id === lastSelection.serverId)
			? lastSelection.serverId
			: null
	);
	let selectedChannelId = $state<string | null>(null);
	let selectedFriendId = $state<string | null>(lastSelection.friendId);
	let signingOut = $state(false);
	let serverDialog = $state<{ view: AddServerView; value: string } | null>(null);
	let addingFriend = $state(false);
	let inviting = $state(false);
	let channelDialog = $state<'category' | ChannelKind | null>(null);

	// svelte-ignore state_referenced_locally
	let workspaces = $state<Record<string, Workspace>>(data.cache.workspaces);
	const workspace = $derived(selectedServerId ? workspaces[selectedServerId] : undefined);
	const categories = $derived(workspace?.categories ?? []);
	const channels = $derived(workspace?.channels ?? []);
	const members = $derived(workspace?.members ?? []);
	const memberIds = $derived(new Set(members.map((member) => member.id)));
	const channelsLoading = $derived(selectedServerId !== null && workspace === undefined);

	const feeds = createFeeds();
	const sync = createSync(feeds);

	// svelte-ignore state_referenced_locally
	const friends = createFriendsState({
		userId: data.userId,
		friends: data.account.friends ?? [],
		online: data.cache.friendsOnline,
		feeds,
		persist: (list) => workspaceCache.saveAccount(data.userId, { username, servers, friends: list })
	});

	const selectedServer = $derived(servers.find((server) => server.id === selectedServerId) ?? null);
	const selectedChannel = $derived(channels.find((c) => c.id === selectedChannelId) ?? null);
	const selectedFriend = $derived.by(() => {
		if (selectedServer || !selectedFriendId) return null;
		return friends.withPresence.find((friend) => friend.id === selectedFriendId) ?? null;
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
			friends.list = account.friends;
		});
	});

	const refreshedServers = new Set<string>();

	async function refreshWorkspace(server: Server) {
		const [loaded, loadedMembers] = await Promise.all([
			loadChannels(server.id),
			loadMembers(server.id, server.ownerId)
		]);
		const fresh = { categories: loaded.categories, channels: loaded.channels, members: loadedMembers };
		workspaces[server.id] = fresh;
		workspaceCache.saveWorkspace(data.userId, server.id, fresh);
	}

	$effect(() => {
		for (const server of servers) {
			if (refreshedServers.has(server.id)) continue;
			refreshedServers.add(server.id);
			void refreshWorkspace(server);
		}
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
			const remembered = current.channels.find(
				(c) => c.id === lastSelection.channelFor(server.id)
			);
			const rememberedVisible =
				remembered && (remembered.kind === 'text' || voice.connected?.channelId === remembered.id);
			selectedChannelId =
				(rememberedVisible ? remembered.id : null) ?? firstTextChannel()?.id ?? null;
		});
	});

	$effect(() => {
		if (selectedServerId && selectedChannelId) {
			lastSelection.setChannel(selectedServerId, selectedChannelId);
		}
	});

	// svelte-ignore state_referenced_locally
	const presence = createServersPresence({
		userId: data.userId,
		initial: data.cache.presence,
		serverIds: () => servers.map((server) => server.id),
		onChannelMessage: (serverId, channelId, message) =>
			incoming.handleChannelMessage(serverId, channelId, message),
		onCategoryCreated: addCategory,
		onChannelCreated: addChannel,
		onMemberJoined: addMember,
		onMessageDeleted: sync.forget
	});

	// svelte-ignore state_referenced_locally
	const occupants = createVoiceOccupants({
		userId: data.userId,
		presence,
		membersOf: (serverId) => workspaces[serverId]?.members ?? [],
		selectedServerId: () => selectedServerId
	});

	// svelte-ignore state_referenced_locally
	const openChat = createOpenChat({ userId: data.userId, feeds, sync, chatId: () => openChatId });

	const pins = createPins({ chatId: () => openChatId, sync });
	const canPin = $derived(
		selectedChannel ? selectedServer?.ownerId === data.userId : selectedFriend !== null
	);
	const canDeleteOthers = $derived(
		selectedChannel !== null && selectedServer?.ownerId === data.userId
	);

	let deleting = $state<{
		chatId: string;
		message: Message;
		busy: boolean;
		error: string | null;
	} | null>(null);

	const deleteFailureText: Record<DeleteFailure, string> = {
		forbidden: 'Нет прав удалить это сообщение',
		rate_limited: 'Слишком часто, попробуйте через минуту',
		failed: 'Не удалось удалить — проверьте соединение'
	};

	function startDelete(message: Message) {
		if (openChatId) deleting = { chatId: openChatId, message, busy: false, error: null };
	}

	async function confirmDelete() {
		const target = deleting;
		if (!target || target.busy) return;
		target.busy = true;
		target.error = null;
		const result = await deleteMessage({ channelId: target.chatId, messageId: target.message.id });
		if (deleting !== target) return;
		if (result.ok) {
			sync.forget(target.chatId, target.message.id);
			deleting = null;
			toast.show('Сообщение удалено');
			return;
		}
		target.busy = false;
		target.error = deleteFailureText[result.reason];
	}

	function copyMessage(message: Message) {
		navigator.clipboard
			.writeText(message.text)
			.then(() => toast.show('Скопировано'))
			.catch(() => {});
	}
	let messageList = $state<ReturnType<typeof MessageList>>();
	let revealingPin = $state(false);

	async function openPinned() {
		const message = pins.current;
		if (!message || revealingPin) return;
		revealingPin = true;
		const found = await openChat.reveal(message.id);
		revealingPin = false;
		if (found) {
			await tick();
			await messageList?.jumpTo(message.id);
		}
		pins.advance();
	}

	// svelte-ignore state_referenced_locally
	const incoming = createIncoming({
		userId: data.userId,
		sync,
		openChatId: () => openChatId,
		isTextChannel: (serverId, channelId) =>
			workspaces[serverId]?.channels.find((c) => c.id === channelId)?.kind === 'text',
		requestCount: () => friends.requests.length,
		onOpenHome: openHome
	});

	const sending = createSending({
		feeds,
		author: () => {
			const ownName = username ?? '';
			const self = members.find((member) => member.id === data.userId);
			return { id: data.userId, username: ownName, name: self?.name ?? ownName };
		}
	});

	const membersWithPresence = $derived.by(() => {
		const online = selectedServer ? presence.byServer[selectedServer.id]?.online : undefined;
		return members.map((member) => ({
			...member,
			online: member.id === data.userId || (online?.has(member.id) ?? false)
		}));
	});

	const activeFriends = $derived(
		findActiveFriends({
			friends: friends.withPresence,
			servers,
			presenceByServer: presence.byServer,
			workspaces
		})
	);

	const unreadServerIds = $derived.by(() => {
		const unreadChannels = new Set(unread.channelIds);
		return new Set(
			servers
				.filter((server) =>
					workspaces[server.id]?.channels.some((channel) => unreadChannels.has(channel.id))
				)
				.map((server) => server.id)
		);
	});

	$effect(() => {
		windowTitle.set(
			selectedServer
				? selectedServer.name
				: selectedFriend
					? `@${selectedFriend.username}`
					: 'Друзья'
		);
		return () => windowTitle.set('');
	});

	let painted = $state(false);
	let veilVisible = $state(true);
	$effect(() => {
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => (painted = true));
		});
		return () => cancelAnimationFrame(frame);
	});

	function selectFriend(friendId: string) {
		selectedFriendId = friendId;
		lastSelection.friendId = friendId;
	}

	function handleEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		if (activeReply) {
			replyTarget = null;
			return;
		}
		if (!selectedFriend) return;
		selectedFriendId = null;
		lastSelection.friendId = null;
	}

	function openHome(directChannelId: string | null) {
		selectedServerId = null;
		if (!directChannelId) return;
		const friend = friends.list.find((known) => known.channelId === directChannelId);
		if (friend) selectFriend(friend.id);
	}

	function prefetchFriend(friendId: string) {
		const channelId = friends.list.find((friend) => friend.id === friendId)?.channelId;
		if (channelId) void sync.warm(channelId);
	}

	function prefetchChannel(channelId: string) {
		const channel = channels.find((c) => c.id === channelId);
		if (channel?.kind === 'text') void sync.warm(channelId);
		else if (channel?.kind === 'voice' && selectedServerId) voice.prefetch(selectedServerId);
	}

	function handleServerCreated(server: Server) {
		servers.push(server);
		selectedServerId = server.id;
		serverDialog = null;
	}

	function handleServerJoined(server: Server) {
		if (!servers.some((known) => known.id === server.id)) servers.push(server);
		selectedServerId = server.id;
		serverDialog = null;
	}

	const joiningInvites = new Set<string>();

	async function openInvite(code: string) {
		if (joiningInvites.has(code)) return;
		joiningInvites.add(code);
		const result = await joinByInvite(code);
		joiningInvites.delete(code);
		if (result.ok) handleServerJoined(result.server);
		else serverDialog = { view: 'join', value: inviteLinkOf(code) };
	}

	function addMember(serverId: string, member: JoinedMember) {
		const target = workspaces[serverId];
		if (!target || target.members.some((known) => known.id === member.id)) return;
		const ownerId = servers.find((server) => server.id === serverId)?.ownerId;
		target.members.push({ ...member, online: false, owner: member.id === ownerId });
	}

	function addCategory(category: Category) {
		const target = workspaces[category.serverId];
		if (!target || target.categories.some((known) => known.id === category.id)) return;
		target.categories.push(category);
	}

	function addChannel(channel: Channel) {
		const target = workspaces[channel.serverId];
		if (!target || target.channels.some((known) => known.id === channel.id)) return;
		target.channels.push(channel);
	}

	function handleCategoryCreated(category: Category) {
		addCategory(category);
		channelDialog = null;
	}

	function handleChannelCreated(channel: Channel) {
		addChannel(channel);
		selectedChannelId = channel.id;
		channelDialog = null;
	}

	function usernameOf(userId: string): string | undefined {
		if (selectedFriend?.id === userId) return selectedFriend.username;
		return members.find((member) => member.id === userId)?.username;
	}

	const typingNames = $derived.by(() => {
		if (!openChatId) return [];
		return typingIn(openChatId)
			.map(usernameOf)
			.filter((name): name is string => name !== undefined);
	});

	const composerPlaceholder = $derived(
		selectedChannel
			? `Написать в ${selectedChannel.name}`
			: selectedFriend
				? `Написать @${selectedFriend.username}`
				: ''
	);

	let replyTarget = $state<{ chatId: string; reply: MessageReply } | null>(null);
	const activeReply = $derived(
		replyTarget && replyTarget.chatId === openChatId ? replyTarget.reply : null
	);

	$effect(() => {
		if (replyTarget && replyTarget.chatId !== openChatId) replyTarget = null;
	});

	let forwarding = $state<{ chatId: string; message: Message } | null>(null);

	function startForward(message: Message) {
		if (openChatId) forwarding = { chatId: openChatId, message };
	}

	async function forwardTo(input: {
		channelIds: string[];
		comment: string;
		clientId: string;
	}): Promise<ForwardResult> {
		const source = forwarding;
		if (!source) return { ok: false, reason: 'failed' };
		const result = await forwardMessage({
			sourceChannelId: source.chatId,
			messageId: source.message.id,
			...input
		});
		if (result.ok) {
			for (const { channelId, message } of result.delivered) sync.receive(channelId, message);
		}
		return result;
	}

	function startReply(message: Message) {
		if (!openChatId) return;
		replyTarget = {
			chatId: openChatId,
			reply: {
				id: message.id,
				original: {
					author: message.author,
					text: message.text,
					forwardedFrom: message.forwardedFrom
				}
			}
		};
	}

	function handleSend(text: string) {
		const channelId = openChatId;
		if (!channelId || !username) return;
		openChat.resetTyping();
		sending.send(channelId, text, activeReply ?? undefined);
		replyTarget = null;
	}

	function cancelSend(messageId: string) {
		if (openChatId) sending.cancel(openChatId, messageId);
	}

	async function handleSignOut() {
		signingOut = true;
		sending.close();
		voice.disconnect();
		await signOut();
		workspaceCache.clear(data.userId);
		await history.clear().catch(() => {});
		signingOut = false;
		await goto('/');
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
</script>

<svelte:window onkeydown={handleEscape} />

<div class="relative flex h-full flex-col">
	{#if veilVisible}
		<div
			aria-hidden="true"
			onanimationend={() => (veilVisible = false)}
			class="pointer-events-none absolute inset-0 z-50 bg-bg {painted ? 'anim-veil' : ''}"
		></div>
	{/if}

	{#if serverDialog}
		<AddServerDialog
			initialView={serverDialog.view}
			initialValue={serverDialog.value}
			oncreated={handleServerCreated}
			onjoined={handleServerJoined}
			onclose={() => (serverDialog = null)}
		/>
	{/if}

	{#if addingFriend}
		<AddFriendDialog friendIds={friends.ids} onclose={() => (addingFriend = false)} />
	{/if}

	{#if selectedServer && inviting}
		<InviteDialog
			serverId={selectedServer.id}
			serverName={selectedServer.name}
			friends={friends.list}
			{memberIds}
			canManage={selectedServer.ownerId === data.userId}
			oninvite={(channelId, link) => sending.send(channelId, link)}
			onclose={() => (inviting = false)}
		/>
	{/if}

	{#if deleting}
		<DeleteMessageDialog
			busy={deleting.busy}
			error={deleting.error}
			onconfirm={confirmDelete}
			onclose={() => (deleting = null)}
		/>
	{/if}

	{#if forwarding}
		<ForwardDialog
			message={forwarding.message}
			friends={friends.withPresence}
			{servers}
			{workspaces}
			onforward={forwardTo}
			onclose={() => (forwarding = null)}
		/>
	{/if}

	{#if selectedServer}
		{#if channelDialog === 'category'}
			<CreateCategoryDialog
				serverId={selectedServer.id}
				serverName={selectedServer.name}
				{categories}
				{channels}
				oncreated={handleCategoryCreated}
				onclose={() => (channelDialog = null)}
			/>
		{:else if channelDialog !== null}
			<CreateChannelDialog
				serverId={selectedServer.id}
				serverName={selectedServer.name}
				initialKind={channelDialog}
				{categories}
				{channels}
				oncreated={handleChannelCreated}
				onclose={() => (channelDialog = null)}
			/>
		{/if}
	{/if}

	<ServerBar
		{servers}
		selectedId={selectedServerId}
		{username}
		{signingOut}
		{unreadServerIds}
		homeUnread={incoming.homeBadge > 0}
		onselect={(id) => (selectedServerId = id)}
		onhome={() => (selectedServerId = null)}
		oncreate={() => (serverDialog = { view: 'create', value: '' })}
		onsignout={handleSignOut}
	/>

	<div class="flex min-h-0 flex-1 gap-3 p-3">
		{#if selectedServer}
			<ChannelPanel
				serverName={selectedServer.name}
				{categories}
				{channels}
				{selectedChannelId}
				voiceOccupants={occupants.byChannel}
				bind:width={panelWidths.channels}
				onselect={selectChannel}
				onprefetch={prefetchChannel}
				oncreatecategory={() => (channelDialog = 'category')}
				oncreatechannel={(kind) => (channelDialog = kind)}
				oninvite={() => (inviting = true)}
				onprefetchinvite={() => prefetchInviteLink(selectedServer.id)}
			/>
		{:else}
			<FriendsPanel
				friends={friends.withPresence}
				requests={friends.requests}
				freshRequestIds={friends.freshRequestIds}
				freshFriendIds={friends.freshFriendIds}
				selectedFriendId={selectedFriend?.id ?? null}
				unreadByFriend={friends.unreadCounts}
				activityByFriend={friends.activity}
				bind:width={panelWidths.channels}
				onselect={selectFriend}
				onprefetch={prefetchFriend}
				onaddfriend={() => (addingFriend = true)}
				onaccept={acceptFriendRequest}
				ondecline={declineFriendRequest}
				onrequestseen={(id) => friends.freshRequestIds.delete(id)}
			/>
		{/if}

		<main class="flex min-w-0 flex-1 flex-col gap-3">
			{#if openChatId}
				{#snippet pinnedToggle()}
					<PinnedToggle
						count={pins.list.length}
						visible={pins.collapsed && pins.list.length > 0}
						onshow={pins.expand}
					/>
				{/snippet}
				{#snippet pinnedBar()}
					<PinnedBar
						message={pins.current}
						position={pins.position}
						count={pins.list.length}
						collapsed={pins.collapsed}
						busy={revealingPin}
						error={pins.error}
						onopen={openPinned}
						onhide={pins.collapse}
					/>
				{/snippet}
				{#if selectedChannel}
					<ChatHeader channel={selectedChannel} trailing={pinnedToggle} />
				{:else if selectedFriend}
					<DirectChatHeader friend={selectedFriend} trailing={pinnedToggle} />
				{/if}
				<MessageList
					bind:this={messageList}
					top={pinnedBar}
					pinnedIds={pins.pinnedIds}
					onpin={canPin ? pins.toggle : undefined}
				oncopy={copyMessage}
				ondelete={startDelete}
				{canDeleteOthers}
					messages={openChat.messages}
					selfId={data.userId}
					hasMore={openChat.hasMore}
					loading={openChat.loading}
					typing={typingNames}
					dividerId={openChat.dividerId}
					onloadolder={openChat.loadOlder}
					oncancel={cancelSend}
					onreply={startReply}
					onforward={startForward}
					onjoinedinvite={handleServerJoined}
					onopeninvite={openInvite}
				/>
				{#key openChatId}
					<MessageComposer
						placeholder={composerPlaceholder}
						reply={activeReply}
						onsend={handleSend}
						ontyping={openChat.touchTyping}
						oncancelreply={() => (replyTarget = null)}
					/>
				{/key}
			{:else if selectedServer}
				<div class="flex flex-1 items-center justify-center">
					{#if !channelsLoading}
						<span class="text-[13px] text-muted">Создай первый канал — через «⋯» у названия сервера</span>
					{/if}
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<HomeEmptyState />
				</div>
			{/if}
		</main>

		<div class="relative flex shrink-0 flex-col gap-3" style="width: {panelWidths.members}px">
			{#if selectedServer}
				<MemberPanel members={membersWithPresence} />
			{:else if selectedFriend}
				<FriendProfile friend={selectedFriend} />
			{:else}
				<ActiveFriendsPanel active={activeFriends} />
			{/if}
			<VoiceDock occupants={occupants.participants} ondisconnect={handleVoiceDisconnect} />
			<ResizeHandle
				side="left"
				bind:width={panelWidths.members}
				min={panelLimits.min}
				max={panelLimits.max}
			/>
		</div>
	</div>
</div>
