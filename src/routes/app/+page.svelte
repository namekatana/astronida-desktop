<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth/auth';
	import ChannelPanel from '$lib/components/ChannelPanel.svelte';
	import ChatHeader from '$lib/components/ChatHeader.svelte';
	import CreateCategoryDialog from '$lib/components/CreateCategoryDialog.svelte';
	import CreateChannelDialog from '$lib/components/CreateChannelDialog.svelte';
	import CreateServerDialog from '$lib/components/CreateServerDialog.svelte';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
	import MemberPanel from '$lib/components/MemberPanel.svelte';
	import MessageComposer from '$lib/components/MessageComposer.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import ResizeHandle from '$lib/components/ResizeHandle.svelte';
	import ServerBar from '$lib/components/ServerBar.svelte';
	import VoiceDock from '$lib/components/VoiceDock.svelte';
	import {
		createCategory,
		createChannel,
		loadChannels,
		type Category,
		type Channel,
		type ChannelKind
	} from '$lib/channels/channels';
	import {
		loadMessages,
		sendMessage,
		subscribeToChannel,
		type Message
	} from '$lib/messages/messages';
	import { mockFriends } from '$lib/mock/friends';
	import { loadMembers, type Member } from '$lib/servers/members';
	import { createServer, type Server } from '$lib/servers/servers';
	import { lastSelection } from '$lib/ui/last-selection.svelte';
	import { panelLimits, panelWidths } from '$lib/ui/panel-widths.svelte';
	import { windowTitle } from '$lib/ui/title.svelte';
	import { voice } from '$lib/voice/voice.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally -- нужно именно начальное значение
	let servers = $state<Server[]>(data.servers);
	// svelte-ignore state_referenced_locally
	let selectedServerId = $state<string | null>(
		data.servers.some((server) => server.id === lastSelection.serverId)
			? lastSelection.serverId
			: null
	);
	let selectedChannelId = $state<string | null>(null);
	let signingOut = $state(false);

	let creating = $state(false);
	let createSubmitting = $state(false);
	let createError = $state('');

	let categories = $state<Category[]>([]);
	let channels = $state<Channel[]>([]);
	let members = $state<Member[]>([]);
	let channelsLoading = $state(false);

	let channelDialog = $state<'category' | ChannelKind | null>(null);
	let channelSubmitting = $state(false);
	let channelError = $state('');

	type Feed = { messages: Message[]; hasMore: boolean };
	let feeds = $state<Record<string, Feed>>({});
	let messagesLoading = $state(false);

	function feedFor(channelId: string): Feed {
		return (feeds[channelId] ??= { messages: [], hasMore: false });
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
		const server = selectedServer;
		lastSelection.serverId = server?.id ?? null;
		categories = [];
		channels = [];
		members = [];
		feeds = {};
		selectedChannelId = null;
		if (!server) return;

		let stale = false;
		channelsLoading = true;
		Promise.all([
			loadChannels(server.id),
			loadMembers(server.id, server.ownerId, data.userId)
		]).then(([loaded, loadedMembers]) => {
			if (stale) return;
			categories = loaded.categories;
			channels = loaded.channels;
			members = loadedMembers;
			channelsLoading = false;
			const remembered = lastSelection.channelFor(server.id);
			selectedChannelId =
				(remembered && channels.some((c) => c.id === remembered) ? remembered : null) ??
				orderedChannels[0]?.id ??
				null;
		});
		return () => {
			stale = true;
		};
	});

	$effect(() => {
		if (selectedServerId && selectedChannelId) {
			lastSelection.setChannel(selectedServerId, selectedChannelId);
		}
	});

	function mergeMessages(channelId: string, incoming: Message[]) {
		const feed = feedFor(channelId);
		const known = new Set(feed.messages.map((m) => m.id));
		const fresh = incoming.filter((message) => !known.has(message.id));
		if (fresh.length === 0) return;
		const last = feed.messages.at(-1);
		const appendsInOrder =
			fresh.every((m, i) => i === 0 || fresh[i - 1].id < m.id) && (!last || last.id < fresh[0].id);
		feed.messages.push(...fresh);
		if (!appendsInOrder) sortMessages(feed);
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
		const unloaded = () => untrack(() => feed.messages.every((m) => m.status !== undefined));
		messagesLoading = unloaded();
		const initialLoad = loadMessages({ channelId: channel.id }).then((loaded) => {
			if (stale) return;
			const firstLoad = unloaded();
			mergeMessages(channel.id, loaded.messages);
			if (firstLoad) feed.hasMore = loaded.hasMore;
			messagesLoading = false;
		});
		const unsubscribe = subscribeToChannel({
			channelId: channel.id,
			onMessage: (message) => {
				if (!stale) mergeMessages(channel.id, [message]);
			},
			onReady: () => {
				initialLoad
					.then(() => {
						if (stale) return;
						return loadMessages({ channelId: channel.id, after: newestConfirmedId(feed) });
					})
					.then((loaded) => {
						if (loaded && !stale) mergeMessages(channel.id, loaded.messages);
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
		categories.push(result.value);
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
		channels.push(result.value);
		selectedChannelId = result.value.id;
		channelDialog = null;
	}

	async function loadOlderMessages() {
		const channel = selectedChannel;
		const oldest = messages[0];
		if (!channel || !oldest || messagesLoading || !hasMoreMessages) return;

		messagesLoading = true;
		const loaded = await loadMessages({ channelId: channel.id, before: oldest.id });
		const feed = feeds[channel.id];
		if (feed) {
			mergeMessages(channel.id, loaded.messages);
			feed.hasMore = loaded.hasMore;
		}
		if (selectedChannel?.id === channel.id) messagesLoading = false;
	}

	let pendingCounter = 0;

	function handleSend(text: string) {
		const channel = selectedChannel;
		if (!channel || !data.username) return;

		const self = members.find((member) => member.id === data.userId);
		const pending: Message = {
			id: `pending:${String(++pendingCounter).padStart(6, '0')}`,
			author: { id: data.userId, username: data.username, name: self?.name ?? data.username },
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
		await signOut();
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
		username={data.username}
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
				bind:width={panelWidths.channels}
				onselect={selectChannel}
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
					onloadolder={loadOlderMessages}
					onretry={retrySend}
				/>
				{#key selectedChannel.id}
					<MessageComposer channelName={selectedChannel.name} onsend={handleSend} />
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
				<MemberPanel {members} />
			{:else}
				<div class="min-h-0 flex-1"></div>
			{/if}
			<VoiceDock />
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
