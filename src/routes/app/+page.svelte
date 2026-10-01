<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth/auth';
	import { workspaceCache } from '$lib/cache/workspace-cache';
	import type { Category, Channel, ChannelKind } from '$lib/channels/channels';
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
	import MessageSkeleton from '$lib/components/MessageSkeleton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PhotoViewer from '$lib/components/PhotoViewer.svelte';
	import PinnedBar from '$lib/components/PinnedBar.svelte';
	import PinnedToggle from '$lib/components/PinnedToggle.svelte';
	import ResizeHandle from '$lib/components/ResizeHandle.svelte';
	import SendPhotosDialog from '$lib/components/SendPhotosDialog.svelte';
	import ServerBar from '$lib/components/ServerBar.svelte';
	import VoiceDock from '$lib/components/VoiceDock.svelte';
	import { findActiveFriends } from '$lib/friends/active-friends';
	import { acceptFriendRequest, declineFriendRequest } from '$lib/friends/channel';
	import { createFriendsState } from '$lib/friends/friends-state.svelte';
	import { history } from '$lib/history/history';
	import type { CompressedImage } from '$lib/media/compress';
	import { forgetImages, warmImageIndex } from '$lib/media/images';
	import { createFeeds } from '$lib/messages/feeds.svelte';
	import type { Message } from '$lib/messages/messages';
	import { createMessageMenu } from '$lib/messages/message-menu.svelte';
	import { createOpenChat } from '$lib/messages/open-chat.svelte';
	import { createPins } from '$lib/messages/pins.svelte';
	import { createSending } from '$lib/messages/sending.svelte';
	import { typingIn } from '$lib/messages/typing.svelte';
	import { createIncoming } from '$lib/notifications/incoming.svelte';
	import { unread } from '$lib/notifications/unread.svelte';
	import { createServersPresence } from '$lib/presence/servers-presence.svelte';
	import { inviteLinkOf, joinByInvite, prefetchInviteLink } from '$lib/servers/invites';
	import type { Server } from '$lib/servers/servers';
	import { createWorkspaces } from '$lib/servers/workspaces.svelte';
	import { createSync } from '$lib/sync/sync';
	import { lastSelection } from '$lib/ui/last-selection.svelte';
	import { panelLimits, panelWidths } from '$lib/ui/panel-widths.svelte';
	import { windowTitle } from '$lib/ui/title.svelte';
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
	let viewer = $state<{
		message: Message;
		index: number;
		origin: DOMRect | null;
	} | null>(null);
	let composer = $state<ReturnType<typeof MessageComposer>>();
	let photoSheet = $state<{ files: File[]; caption: string } | null>(null);
	let draggingFiles = $state(false);
	let dragDepth = 0;

	// svelte-ignore state_referenced_locally
	const workspaces = createWorkspaces({
		userId: data.userId,
		initial: data.cache.workspaces,
		servers: () => servers
	});
	const workspace = $derived(selectedServerId ? workspaces.all[selectedServerId] : undefined);
	const categories = $derived(workspace?.categories ?? []);
	const channels = $derived(workspace?.channels ?? []);
	const members = $derived(workspace?.members ?? []);
	const memberIds = $derived(new Set(members.map((member) => member.id)));
	const channelsLoading = $derived(selectedServerId !== null && workspace === undefined);

	const feeds = createFeeds();
	const sync = createSync(feeds);

	$effect(() => {
		warmImageIndex();
	});

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
		onCategoryCreated: workspaces.addCategory,
		onChannelCreated: workspaces.addChannel,
		onMemberJoined: workspaces.addMember,
		onMessageDeleted: sync.forget
	});

	// svelte-ignore state_referenced_locally
	const occupants = createVoiceOccupants({
		userId: data.userId,
		presence,
		membersOf: (serverId) => workspaces.all[serverId]?.members ?? [],
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

	const menu = createMessageMenu({ chatId: () => openChatId, sync });

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
		isTextChannel: workspaces.isTextChannel,
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
			workspaces: workspaces.all
		})
	);

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
		if (menu.reply) {
			menu.clearReply();
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

	function handleCategoryCreated(category: Category) {
		workspaces.addCategory(category);
		channelDialog = null;
	}

	function handleChannelCreated(channel: Channel) {
		workspaces.addChannel(channel);
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

	function handleSend(text: string, images: CompressedImage[] = []) {
		const channelId = openChatId;
		if (!channelId || !username) return;
		openChat.resetTyping();
		sending.send(channelId, text, menu.reply ?? undefined, images);
		menu.clearReply();
	}

	function openPhotoSheet(files: File[]) {
		if (photoSheet) return;
		photoSheet = { files, caption: composer?.takeText() ?? '' };
	}

	function closePhotoSheet(caption: string) {
		composer?.restoreText(caption);
	}

	function openPhoto(message: Message, index: number, element: HTMLElement) {
		viewer = { message, index, origin: element.getBoundingClientRect() };
	}

	function forwardFromViewer(message: Message) {
		viewer = null;
		menu.startForward(message);
	}

	$effect(() => {
		void openChatId;
		untrack(() => {
			viewer = null;
			photoSheet = null;
		});
	});

	function carriesFiles(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function handleDragEnter(event: DragEvent) {
		if (!carriesFiles(event)) return;
		event.preventDefault();
		dragDepth += 1;
		draggingFiles = true;
	}

	function handleDragOver(event: DragEvent) {
		if (!carriesFiles(event) || !event.dataTransfer) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function handleDragLeave(event: DragEvent) {
		if (!carriesFiles(event)) return;
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) draggingFiles = false;
	}

	function handleDrop(event: DragEvent) {
		if (!carriesFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		draggingFiles = false;
		composer?.attach([...(event.dataTransfer?.files ?? [])]);
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
		forgetImages();
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

	{#if menu.deleting}
		<DeleteMessageDialog
			message={menu.deleting.message}
			busy={menu.deleting.busy}
			error={menu.deleting.error}
			onconfirm={menu.confirmDelete}
			onclose={menu.closeDelete}
		/>
	{/if}

	{#if photoSheet && openChatId}
		<SendPhotosDialog
			files={photoSheet.files}
			caption={photoSheet.caption}
			onsend={handleSend}
			onclose={closePhotoSheet}
			onclosed={() => (photoSheet = null)}
		/>
	{/if}

	{#if viewer}
		<PhotoViewer
			message={viewer.message}
			index={viewer.index}
			origin={viewer.origin}
			onnavigate={(index) => viewer && (viewer = { ...viewer, index, origin: null })}
			onforward={forwardFromViewer}
			onclose={() => (viewer = null)}
		/>
	{/if}

	{#if menu.forwarding}
		<ForwardDialog
			message={menu.forwarding.message}
			friends={friends.withPresence}
			{servers}
			workspaces={workspaces.all}
			onforward={menu.forwardTo}
			onclose={menu.closeForward}
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
				loading={channelsLoading}
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

		<main
			class="relative flex min-w-0 flex-1 flex-col gap-3"
			ondragenter={openChatId ? handleDragEnter : undefined}
			ondragover={openChatId ? handleDragOver : undefined}
			ondragleave={openChatId ? handleDragLeave : undefined}
			ondrop={openChatId ? handleDrop : undefined}
		>
			{#if openChatId && draggingFiles}
				<div
					transition:fade={{ duration: 150 }}
					class="panel-deep pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/20"
				>
					<Icon name="image" size={28} class="text-ink-secondary" />
					<p class="text-[15px] font-semibold text-ink">Отпустите, чтобы прикрепить фото</p>
					<p class="text-[13px] text-muted">До 10 фото в одном сообщении</p>
				</div>
			{/if}
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
					oncopy={menu.copy}
					ondelete={menu.startDelete}
					{canDeleteOthers}
					messages={openChat.messages}
					selfId={data.userId}
					hasMore={openChat.hasMore}
					loading={openChat.loading}
					typing={typingNames}
					dividerId={openChat.dividerId}
					onloadolder={openChat.loadOlder}
					oncancel={cancelSend}
					onreply={menu.startReply}
					onforward={menu.startForward}
					onjoinedinvite={handleServerJoined}
					onopeninvite={openInvite}
					onopenphoto={openPhoto}
				/>
				{#key openChatId}
					<MessageComposer
						bind:this={composer}
						placeholder={composerPlaceholder}
						reply={menu.reply}
						onsend={handleSend}
						onattach={openPhotoSheet}
						ontyping={openChat.touchTyping}
						oncancelreply={menu.clearReply}
					/>
				{/key}
			{:else if selectedServer && channelsLoading}
				<div aria-hidden="true" class="flex min-h-0 flex-1 flex-col gap-3">
					<div class="panel flex shrink-0 items-center gap-2.5 px-5 py-3.5">
						<span class="skeleton h-4 w-4 rounded-[5px]"></span>
						<span class="skeleton my-[7px] h-2.5 w-32 rounded-full"></span>
					</div>
					<div class="panel-deep flex min-h-0 flex-1 flex-col justify-end px-2 pt-3 pb-7">
						<MessageSkeleton />
					</div>
					<div class="panel h-14 shrink-0 rounded-[28px] [corner-shape:round]"></div>
				</div>
			{:else if selectedServer}
				<div class="flex flex-1 items-center justify-center">
					<span class="text-[13px] text-muted">Создай первый канал — через «⋯» у названия сервера</span>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<HomeEmptyState />
				</div>
			{/if}
		</main>

		<div class="relative flex shrink-0 flex-col gap-3" style="width: {panelWidths.members}px">
			{#if selectedServer}
				<MemberPanel members={membersWithPresence} loading={members.length === 0} />
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
