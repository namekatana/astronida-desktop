<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth/auth';
	import { workspaceCache, type Workspace } from '$lib/cache/workspace-cache';
	import ChannelPanel from '$lib/components/ChannelPanel.svelte';
	import ChatHeader from '$lib/components/ChatHeader.svelte';
	import CreateCategoryDialog from '$lib/components/CreateCategoryDialog.svelte';
	import CreateChannelDialog from '$lib/components/CreateChannelDialog.svelte';
	import CreateServerDialog from '$lib/components/CreateServerDialog.svelte';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
	import { history, type HistoryCoverage } from '$lib/history/history';
	import MemberPanel from '$lib/components/MemberPanel.svelte';
	import MessageComposer from '$lib/components/MessageComposer.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import ResizeHandle from '$lib/components/ResizeHandle.svelte';
	import ServerBar from '$lib/components/ServerBar.svelte';
	import VoiceDock from '$lib/components/VoiceDock.svelte';
	import { createCategory, createChannel, loadChannels, type ChannelKind } from '$lib/channels/channels';
	import {
		loadMessages,
		pageSize,
		sendMessage,
		sendTyping,
		subscribeToChannel,
		type Message
	} from '$lib/messages/messages';
	import { clearTyping, createTypingSender, markTyping, typingIn } from '$lib/messages/typing.svelte';
	import { mockFriends } from '$lib/mock/friends';
	import {
		subscribeToServerPresence,
		type ServerPresence,
		type VoiceAnnouncement
	} from '$lib/presence/presence';
	import { loadMembers } from '$lib/servers/members';
	import { createServer, type Server } from '$lib/servers/servers';
	import { lastSelection } from '$lib/ui/last-selection.svelte';
	import { panelLimits, panelWidths } from '$lib/ui/panel-widths.svelte';
	import { windowTitle } from '$lib/ui/title.svelte';
	import type { VoiceOccupant } from '$lib/voice/occupant';
	import { qualityFromStats, worstQuality } from '$lib/voice/quality';
	import { createRosterWatcher } from '$lib/voice/roster-watch';
	import type { VoiceQuality, VoiceStats } from '$lib/voice/transport';
	import { playToggleSound } from '$lib/voice/sounds';
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
	let signingOut = $state(false);

	let creating = $state(false);
	let createSubmitting = $state(false);
	let createError = $state('');

	// svelte-ignore state_referenced_locally
	let workspaces = $state<Record<string, Workspace>>(data.cache.workspaces);
	const workspace = $derived(selectedServerId ? workspaces[selectedServerId] : undefined);
	const categories = $derived(workspace?.categories ?? []);
	const channels = $derived(workspace?.channels ?? []);
	const members = $derived(workspace?.members ?? []);
	const channelsLoading = $derived(selectedServerId !== null && workspace === undefined);

	let channelDialog = $state<'category' | ChannelKind | null>(null);
	let channelSubmitting = $state(false);
	let channelError = $state('');

	type Feed = { messages: Message[]; hasMore: boolean; localExhausted: boolean; opened: boolean };
	let feeds = $state<Record<string, Feed>>({});
	let messagesLoading = $state(false);

	function feedFor(channelId: string): Feed {
		return (feeds[channelId] ??= {
			messages: [],
			hasMore: false,
			localExhausted: false,
			opened: false
		});
	}

	const selectedServer = $derived(servers.find((server) => server.id === selectedServerId) ?? null);
	const selectedChannel = $derived(channels.find((c) => c.id === selectedChannelId) ?? null);
	const messages = $derived(selectedChannel ? (feeds[selectedChannel.id]?.messages ?? []) : []);
	const hasMoreMessages = $derived(
		selectedChannel ? (feeds[selectedChannel.id]?.hasMore ?? false) : false
	);

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
	let presenceByServer = $state<Record<string, ServerPresence>>(data.cache.presence);
	const presenceSubscriptions = new Map<string, () => void>();

	function announcementFor(serverId: string): VoiceAnnouncement | null {
		const connected = voice.connected;
		if (!connected || connected.serverId !== serverId || voice.status === 'failed') return null;
		return {
			channelId: connected.channelId,
			micMuted: voice.micMuted,
			deafened: voice.deafened
		};
	}

	$effect(() => {
		const ids = new Set(servers.map((server) => server.id));
		untrack(() => {
			for (const id of ids) {
				if (presenceSubscriptions.has(id)) continue;
				presenceSubscriptions.set(
					id,
					subscribeToServerPresence({
						serverId: id,
						voiceAnnouncement: () => announcementFor(id),
						onSync: (presence) => {
							presenceByServer[id] = presence;
							workspaceCache.savePresence(data.userId, id, presence);
						},
						onVoiceKeyRotated: (channelId, version) =>
							voice.handleKeyRotation(id, channelId, version),
						onVoiceRejoined: (channelId, key) => voice.handleRejoin(id, channelId, key)
					})
				);
			}
			for (const [id, unsubscribe] of presenceSubscriptions) {
				if (ids.has(id)) continue;
				unsubscribe();
				presenceSubscriptions.delete(id);
				delete presenceByServer[id];
			}
		});
	});

	$effect(() => {
		return () => {
			for (const unsubscribe of presenceSubscriptions.values()) unsubscribe();
			presenceSubscriptions.clear();
		};
	});

	const membersWithPresence = $derived.by(() => {
		const online = selectedServer ? presenceByServer[selectedServer.id]?.online : undefined;
		return members.map((member) => ({
			...member,
			online: member.id === data.userId || (online?.has(member.id) ?? false)
		}));
	});

	function occupantsOf(serverId: string, channelId: string): VoiceOccupant[] {
		const roster = workspaces[serverId]?.members ?? [];
		const inVoice = presenceByServer[serverId]?.voice[channelId] ?? [];
		const inMyRoom = voice.connected?.channelId === channelId;
		const speakingHere = inMyRoom ? voice.speakingIds : [];
		const statsOf = (userId: string): VoiceStats | null => {
			if (!inMyRoom) return null;
			if (userId === data.userId) return voice.stats;
			return voice.participantStats[userId] ?? null;
		};
		const qualityOf = (userId: string, stats: VoiceStats | null): VoiceQuality | null => {
			if (!inMyRoom) return null;
			if (userId === data.userId) return voice.quality;
			return worstQuality(qualityFromStats(stats), voice.participantQuality[userId]);
		};
		const listed = inVoice.flatMap((entry) =>
			roster
				.filter((member) => member.id === entry.userId)
				.map((member) => {
					const stats = statsOf(member.id);
					return {
						...member,
						self: member.id === data.userId,
						micMuted: entry.micMuted,
						deafened: entry.deafened,
						speaking: speakingHere.includes(member.id),
						quality: qualityOf(member.id, stats),
						stats
					};
				})
		);
		const selfIndex = listed.findIndex((member) => member.id === data.userId);
		if (selfIndex <= 0) return listed;
		return [listed[selfIndex], ...listed.slice(0, selfIndex), ...listed.slice(selfIndex + 1)];
	}

	const voiceOccupants = $derived.by((): Record<string, VoiceOccupant[]> => {
		const serverId = selectedServerId;
		if (!serverId) return {};
		const byChannel = presenceByServer[serverId]?.voice ?? {};
		return Object.fromEntries(
			Object.keys(byChannel).map((channelId) => [channelId, occupantsOf(serverId, channelId)])
		);
	});

	const voiceParticipants = $derived.by((): VoiceOccupant[] => {
		const connected = voice.connected;
		if (!connected) return [];
		return occupantsOf(connected.serverId, connected.channelId);
	});

	// svelte-ignore state_referenced_locally
	const roster = createRosterWatcher(data.userId);

	$effect(() => {
		const connected = voice.connected;
		const settled = voice.status === 'connected' || voice.status === 'reconnecting';
		const room = connected && settled ? connected : null;
		const userIds = room
			? (presenceByServer[room.serverId]?.voice[room.channelId] ?? []).map((entry) => entry.userId)
			: [];
		const change = roster.update(room?.channelId ?? null, userIds);
		if (change.joined.length > 0) playToggleSound('user-joined');
		if (change.left.length > 0) playToggleSound('user-left');
	});

	function dropMissing(feed: Feed, incoming: Message[], coverage: HistoryCoverage): boolean {
		const oldest = coverage.hasMore ? incoming[0]?.id : undefined;
		if (coverage.hasMore && oldest === undefined) return false;
		const present = new Set(incoming.map((m) => m.id));
		const kept = feed.messages.filter(
			(m) =>
				m.status !== undefined ||
				present.has(m.id) ||
				(oldest !== undefined && m.id < oldest) ||
				(coverage.before !== undefined && m.id >= coverage.before)
		);
		if (kept.length === feed.messages.length) return false;
		feed.messages = kept;
		return true;
	}

	function mergeMessages(channelId: string, incoming: Message[], coverage?: HistoryCoverage) {
		const feed = feedFor(channelId);
		if (coverage) dropMissing(feed, incoming, coverage);
		const known = new Set(feed.messages.map((m) => m.id));
		const fresh = incoming.filter((message) => !known.has(message.id));
		if (fresh.length === 0) return;
		const last = feed.messages.at(-1);
		const appendsInOrder =
			fresh.every((m, i) => i === 0 || fresh[i - 1].id < m.id) && (!last || last.id < fresh[0].id);
		feed.messages.push(...fresh);
		if (!appendsInOrder) sortMessages(feed);
	}

	function absorb(
		channelId: string,
		incoming: Message[],
		options?: { coverage?: HistoryCoverage; reachedStart?: boolean }
	) {
		mergeMessages(channelId, incoming, options?.coverage);
		history.store(channelId, incoming, options).catch(() => {});
	}

	function unloaded(feed: Feed) {
		return feed.messages.every((m) => m.status !== undefined);
	}

	async function openFeed(channelId: string) {
		const feed = feedFor(channelId);
		if (!unloaded(feed)) return;
		try {
			const page = await history.page(channelId);
			mergeMessages(channelId, page.messages);
			feed.localExhausted = page.messages.length < pageSize;
			feed.hasMore = !feed.localExhausted || !page.reachedStart;
		} catch {
			feed.localExhausted = true;
			feed.hasMore = true;
		}
	}

	const maxCatchUpPages = 10;
	const syncs = new Map<string, Promise<void>>();

	function scheduleSync(channelId: string): Promise<void> {
		const next = (syncs.get(channelId) ?? Promise.resolve())
			.then(() => syncChannel(channelId))
			.catch(() => {});
		syncs.set(channelId, next);
		return next;
	}

	async function syncChannel(channelId: string) {
		const feed = feedFor(channelId);
		const newestLocal = newestConfirmedId(feed);
		const latest = await loadMessages({ channelId });
		if (!latest) return;
		absorb(channelId, latest.messages, {
			coverage: { hasMore: latest.hasMore },
			reachedStart: latest.hasMore ? undefined : true
		});
		const oldest = latest.messages[0]?.id;
		if (newestLocal === undefined || !latest.hasMore || oldest === undefined) {
			feed.localExhausted = true;
			feed.hasMore = latest.hasMore;
			return;
		}
		if (oldest <= newestLocal) return;

		let cursor = newestLocal;
		for (let page = 1; page < maxCatchUpPages; page++) {
			const loaded = await loadMessages({ channelId, after: cursor });
			if (!loaded) return;
			absorb(channelId, loaded.messages);
			const last = loaded.messages.at(-1)?.id;
			if (!loaded.hasMore || last === undefined || last >= oldest) return;
			cursor = last;
		}
		await resetFeed(channelId);
	}

	async function resetFeed(channelId: string) {
		const latest = await loadMessages({ channelId });
		if (!latest) return;
		await history.dropChannel(channelId);
		const feed = feedFor(channelId);
		feed.messages = feed.messages.filter((m) => m.status !== undefined);
		absorb(channelId, latest.messages, { reachedStart: !latest.hasMore });
		feed.localExhausted = true;
		feed.hasMore = latest.hasMore;
	}

	function newestConfirmedId(feed: Feed): string | undefined {
		for (let i = feed.messages.length - 1; i >= 0; i--) {
			if (feed.messages[i].status === undefined) return feed.messages[i].id;
		}
		return undefined;
	}

	function sortMessages(feed: Feed) {
		feed.messages.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	}

	$effect(() => {
		const channel = selectedChannel;
		messagesLoading = false;
		if (!channel) return;

		let stale = false;
		const feed = untrack(() => feedFor(channel.id));
		messagesLoading = untrack(() => unloaded(feed));
		const opened = untrack(() => openFeed(channel.id))
			.then(() => {
				if (!stale && !unloaded(feed)) messagesLoading = false;
				return scheduleSync(channel.id);
			})
			.then(() => {
				if (!stale) messagesLoading = false;
			});
		const unsubscribe = subscribeToChannel({
			channelId: channel.id,
			onMessage: (message) => {
				if (stale) return;
				clearTyping(channel.id, message.author.id);
				absorb(channel.id, [message]);
			},
			onTyping: (userId) => {
				if (!stale && userId !== data.userId) markTyping(channel.id, userId);
			},
			onReady: () => {
				opened.then(() => {
					if (!stale) void scheduleSync(channel.id);
				});
			}
		});
		return () => {
			stale = true;
			unsubscribe();
		};
	});

	$effect(() => {
		windowTitle.set(selectedServer ? selectedServer.name : 'Друзья');
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

	function openCreateDialog() {
		createError = '';
		creating = true;
	}

	async function handleCreateServer(name: string) {
		createSubmitting = true;
		createError = '';
		const result = await createServer(name, data.userId);
		createSubmitting = false;

		if (!result.ok) {
			createError = result.message;
			return;
		}
		servers.push(result.server);
		selectedServerId = result.server.id;
		creating = false;
	}

	function openChannelDialog(kind: 'category' | ChannelKind) {
		channelError = '';
		channelDialog = kind;
	}

	async function handleCreateCategory(name: string) {
		if (!selectedServerId) return;
		channelSubmitting = true;
		channelError = '';
		const result = await createCategory(selectedServerId, name, categories.length);
		channelSubmitting = false;

		if (!result.ok) {
			channelError = result.message;
			return;
		}
		workspace?.categories.push(result.value);
		channelDialog = null;
	}

	async function handleCreateChannel(input: {
		name: string;
		kind: ChannelKind;
		categoryId: string | null;
	}) {
		if (!selectedServerId) return;
		channelSubmitting = true;
		channelError = '';
		const result = await createChannel({
			serverId: selectedServerId,
			categoryId: input.categoryId,
			name: input.name,
			kind: input.kind,
			position: channels.length
		});
		channelSubmitting = false;

		if (!result.ok) {
			channelError = result.message;
			return;
		}
		workspace?.channels.push(result.value);
		selectedChannelId = result.value.id;
		channelDialog = null;
	}

	async function loadOlderMessages() {
		const channel = selectedChannel;
		const oldest = messages[0];
		if (!channel || !oldest || messagesLoading || !hasMoreMessages) return;

		messagesLoading = true;
		const feed = feedFor(channel.id);
		if (feed.localExhausted) {
			await loadOlderFromServer(channel.id, oldest.id);
		} else {
			await loadOlderFromDisk(channel.id, oldest.id);
		}
		if (selectedChannel?.id === channel.id) messagesLoading = false;
	}

	async function loadOlderFromDisk(channelId: string, before: string) {
		const feed = feedFor(channelId);
		try {
			const page = await history.page(channelId, before);
			mergeMessages(channelId, page.messages);
			feed.localExhausted = page.messages.length < pageSize;
			feed.hasMore = !feed.localExhausted || !page.reachedStart;
		} catch {
			feed.localExhausted = true;
		}
	}

	async function loadOlderFromServer(channelId: string, before: string) {
		const loaded = await loadMessages({ channelId, before });
		if (!loaded) return;
		absorb(channelId, loaded.messages, {
			coverage: { before, hasMore: loaded.hasMore },
			reachedStart: !loaded.hasMore
		});
		feedFor(channelId).hasMore = loaded.hasMore;
	}

	let pendingCounter = 0;

	const typingSender = createTypingSender(() => {
		if (selectedChannel) sendTyping(selectedChannel.id);
	});

	$effect(() => {
		void selectedChannelId;
		typingSender.reset();
	});

	const typingNames = $derived.by(() => {
		if (!selectedChannel) return [];
		return typingIn(selectedChannel.id)
			.map((userId) => members.find((member) => member.id === userId)?.username)
			.filter((name): name is string => name !== undefined);
	});

	function handleSend(text: string) {
		const channel = selectedChannel;
		if (!channel || !username) return;
		typingSender.reset();

		const self = members.find((member) => member.id === data.userId);
		const pending: Message = {
			id: `pending:${String(++pendingCounter).padStart(6, '0')}`,
			author: { id: data.userId, username, name: self?.name ?? username },
			text: text.trim(),
			sentAt: new Date(),
			status: 'sending'
		};
		feedFor(channel.id).messages.push(pending);
		void deliver(channel.id, pending);
	}

	async function deliver(channelId: string, pending: Message) {
		const result = await sendMessage({ channelId, text: pending.text });
		const feed = feeds[channelId];
		if (!feed) return;
		const index = feed.messages.findIndex((m) => m.id === pending.id);
		if (index === -1) return;

		if (!result.ok) {
			feed.messages[index].status = 'failed';
			return;
		}
		if (feed.messages.some((m) => m.id === result.message.id)) {
			feed.messages.splice(index, 1);
			return;
		}
		feed.messages[index] = result.message;
		sortMessages(feed);
		history.store(channelId, [result.message]).catch(() => {});
	}

	function retrySend(messageId: string) {
		const channel = selectedChannel;
		const message = channel && feeds[channel.id]?.messages.find((m) => m.id === messageId);
		if (!channel || !message || message.status !== 'failed') return;
		message.status = 'sending';
		void deliver(channel.id, message);
	}

	async function handleSignOut() {
		signingOut = true;
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

	function prefetchVoice() {
		if (selectedServerId) voice.prefetch(selectedServerId);
	}

	function firstTextChannel() {
		return orderedChannels.find((c) => c.kind === 'text') ?? null;
	}

	function handleVoiceDisconnect() {
		if (selectedChannel?.kind !== 'voice') return;
		selectedChannelId = firstTextChannel()?.id ?? null;
	}
</script>

<div class="relative flex h-full flex-col">
	{#if veilVisible}
		<div
			aria-hidden="true"
			onanimationend={() => (veilVisible = false)}
			class="pointer-events-none absolute inset-0 z-50 bg-bg {painted ? 'anim-veil' : ''}"
		></div>
	{/if}

	{#if creating}
		<CreateServerDialog
			serverError={createError}
			submitting={createSubmitting}
			onsubmit={handleCreateServer}
			onclose={() => (creating = false)}
		/>
	{/if}

	{#if channelDialog === 'category'}
		<CreateCategoryDialog
			serverError={channelError}
			submitting={channelSubmitting}
			onsubmit={handleCreateCategory}
			onclose={() => (channelDialog = null)}
		/>
	{:else if channelDialog !== null}
		<CreateChannelDialog
			initialKind={channelDialog}
			{categories}
			serverError={channelError}
			submitting={channelSubmitting}
			onsubmit={handleCreateChannel}
			onclose={() => (channelDialog = null)}
		/>
	{/if}

	<ServerBar
		{servers}
		selectedId={selectedServerId}
		{username}
		{signingOut}
		onselect={(id) => (selectedServerId = id)}
		onhome={() => (selectedServerId = null)}
		oncreate={openCreateDialog}
		onsignout={handleSignOut}
	/>

	<div class="flex min-h-0 flex-1 gap-3 p-3">
		{#if selectedServer}
			<ChannelPanel
				serverName={selectedServer.name}
				{categories}
				{channels}
				{selectedChannelId}
				{voiceOccupants}
				bind:width={panelWidths.channels}
				onselect={selectChannel}
				onprefetch={prefetchVoice}
				oncreatecategory={() => openChannelDialog('category')}
				oncreatechannel={openChannelDialog}
			/>
		{:else}
			<FriendsPanel friends={mockFriends} bind:width={panelWidths.channels} />
		{/if}

		<main class="flex min-w-0 flex-1 flex-col gap-3">
			{#if selectedChannel}
				<ChatHeader channel={selectedChannel} />
				<MessageList
					{messages}
					hasMore={hasMoreMessages}
					loading={messagesLoading}
					typing={typingNames}
					onloadolder={loadOlderMessages}
					onretry={retrySend}
				/>
				{#key selectedChannel.id}
					<MessageComposer
						channelName={selectedChannel.name}
						onsend={handleSend}
						ontyping={typingSender.touch}
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
					<span class="text-[13px] tracking-[0.2em] text-muted uppercase">Друзья</span>
				</div>
			{/if}
		</main>

		<div class="relative flex shrink-0 flex-col gap-3" style="width: {panelWidths.members}px">
			{#if selectedServer}
				<MemberPanel members={membersWithPresence} />
			{:else}
				<div class="min-h-0 flex-1"></div>
			{/if}
			<VoiceDock occupants={voiceParticipants} ondisconnect={handleVoiceDisconnect} />
			{#if selectedServer}
				<ResizeHandle
					side="left"
					bind:width={panelWidths.members}
					min={panelLimits.min}
					max={panelLimits.max}
				/>
			{/if}
		</div>
	</div>
</div>
