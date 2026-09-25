<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth/auth';
	import { workspaceCache, type Workspace } from '$lib/cache/workspace-cache';
	import ChannelPanel from '$lib/components/ChannelPanel.svelte';
	import ChatHeader from '$lib/components/ChatHeader.svelte';
	import DirectChatHeader from '$lib/components/DirectChatHeader.svelte';
	import CreateCategoryDialog from '$lib/components/CreateCategoryDialog.svelte';
	import CreateChannelDialog from '$lib/components/CreateChannelDialog.svelte';
	import CreateServerDialog from '$lib/components/CreateServerDialog.svelte';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
	import AddFriendDialog from '$lib/components/AddFriendDialog.svelte';
	import type { Friend } from '$lib/friends/friends';
	import {
		acceptFriendRequest,
		declineFriendRequest,
		subscribeToFriends
	} from '$lib/friends/channel';
	import { markRead, subscribeToInbox } from '$lib/notifications/inbox';
	import {
		onNotificationActivated,
		requestAttention,
		showNotification
	} from '$lib/notifications/notify';
	import { playDirectMessageSound, playFriendRequestSound } from '$lib/notifications/sounds';
	import { setTaskbarBadge } from '$lib/notifications/taskbar';
	import { unread } from '$lib/notifications/unread.svelte';
	import { windowFocus } from '$lib/ui/window-focus.svelte';
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
	import {
		subscribeToServerPresence,
		type ChannelActivity,
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
	let friends = $state<Friend[]>(data.account.friends ?? []);
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
	let selectedFriendId = $state<string | null>(lastSelection.friendId);
	const selectedFriend = $derived.by(() => {
		if (selectedServer || !selectedFriendId) return null;
		return friendsWithPresence.find((friend) => friend.id === selectedFriendId) ?? null;
	});
	const openChatId = $derived(selectedChannel?.id ?? selectedFriend?.channelId ?? null);
	const messages = $derived(openChatId ? (feeds[openChatId]?.messages ?? []) : []);
	const hasMoreMessages = $derived(openChatId ? (feeds[openChatId]?.hasMore ?? false) : false);

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
			friends = account.friends;
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
						onVoiceRejoined: (channelId, key) => voice.handleRejoin(id, channelId, key),
						onChannelActivity: (activity) => handleChannelActivity(id, activity)
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

	// svelte-ignore state_referenced_locally
	let friendsOnline = $state<Set<string>>(data.cache.friendsOnline);
	let friendRequests = $state<Friend[]>([]);
	const freshRequestIds = new SvelteSet<string>();
	const freshFriendIds = new SvelteSet<string>();
	const freshFriendMs = 1000;
	let addingFriend = $state(false);

	function addFriend(friend: Friend) {
		const known = friends.find((existing) => existing.id === friend.id);
		if (known) {
			known.channelId ??= friend.channelId;
			return;
		}
		freshFriendIds.add(friend.id);
		setTimeout(() => freshFriendIds.delete(friend.id), freshFriendMs);
		friends = [...friends, friend];
		workspaceCache.saveAccount(data.userId, { username, servers, friends });
	}

	$effect(() => {
		return subscribeToFriends({
			userId: data.userId,
			onOnline: (online) => {
				friendsOnline = online;
				workspaceCache.saveFriendsOnline(data.userId, online);
			},
			onRequests: (requests) => (friendRequests = requests),
			onRequestReceived: (request) => {
				freshRequestIds.add(request.id);
				playFriendRequestSound();
				if (windowFocus.active) return;
				void showNotification({
					title: 'Запрос в друзья',
					body: `@${request.username} хочет добавить вас в друзья`,
					target: { kind: 'requests' }
				});
				void requestAttention();
			},
			onFriendAdded: addFriend
		});
	});

	const friendIds = $derived(new Set(friends.map((friend) => friend.id)));

	const friendsWithPresence = $derived(
		friends.map((friend) => ({ ...friend, online: friendsOnline.has(friend.id), owner: false }))
	);

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
		const byId = new Map(roster.map((member) => [member.id, member]));
		const speaking = new Set(speakingHere);
		const listed: VoiceOccupant[] = [];
		for (const entry of inVoice) {
			const member = byId.get(entry.userId);
			if (!member) continue;
			const stats = statsOf(member.id);
			listed.push({
				...member,
				self: member.id === data.userId,
				micMuted: entry.micMuted,
				deafened: entry.deafened,
				speaking: speaking.has(member.id),
				quality: qualityOf(member.id, stats),
				stats
			});
		}
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
		const channelId = openChatId;
		messagesLoading = false;
		if (!channelId) return;

		let stale = false;
		const feed = untrack(() => feedFor(channelId));
		messagesLoading = untrack(() => unloaded(feed));
		const opened = untrack(() => openFeed(channelId))
			.then(() => {
				if (!stale && !unloaded(feed)) messagesLoading = false;
				return scheduleSync(channelId);
			})
			.then(() => {
				if (!stale) messagesLoading = false;
			});
		const unsubscribe = subscribeToChannel({
			channelId,
			onMessage: (message) => {
				if (stale) return;
				clearTyping(channelId, message.author.id);
				absorb(channelId, [message]);
			},
			onTyping: (userId) => {
				if (!stale && userId !== data.userId) markTyping(channelId, userId);
			},
			onReady: () => {
				opened.then(() => {
					if (!stale) void scheduleSync(channelId);
				});
			}
		});
		return () => {
			stale = true;
			unsubscribe();
		};
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

	function selectFriend(friendId: string) {
		selectedFriendId = friendId;
		lastSelection.friendId = friendId;
	}

	function isViewing(channelId: string): boolean {
		return openChatId === channelId && windowFocus.active;
	}

	function handleDirectMessage(channelId: string, message: Message) {
		if (isViewing(channelId)) {
			markRead(channelId, message.id);
			return;
		}
		unread.addDirect(channelId, message.id);
		playDirectMessageSound();
		if (windowFocus.active) return;
		void showNotification({
			title: `@${message.author.username}`,
			body: message.text,
			target: { kind: 'direct', channelId }
		});
		void requestAttention();
	}

	function handleChannelActivity(serverId: string, activity: ChannelActivity) {
		if (activity.authorId === data.userId) return;
		const channel = workspaces[serverId]?.channels.find((c) => c.id === activity.channelId);
		if (channel?.kind !== 'text') return;
		if (isViewing(activity.channelId)) {
			markRead(activity.channelId, activity.messageId);
			return;
		}
		unread.addChannel(activity.channelId, activity.messageId);
	}

	$effect(() => {
		return subscribeToInbox({
			userId: data.userId,
			onSnapshot: (snapshot) => unread.replace(snapshot),
			onDirectMessage: handleDirectMessage,
			onRead: (channelId, messageId) => unread.clear(channelId, messageId)
		});
	});

	$effect(() => {
		const channelId = openChatId;
		if (!channelId || !windowFocus.active) return;
		const newest = unread.newestFor(channelId);
		if (!newest) return;
		markRead(channelId, newest);
		unread.clear(channelId, newest);
	});

	$effect(() => {
		return onNotificationActivated((target) => {
			selectedServerId = null;
			if (target.kind !== 'direct') return;
			const friend = friends.find((known) => known.channelId === target.channelId);
			if (friend) selectFriend(friend.id);
		});
	});

	const homeBadge = $derived(unread.directTotal + friendRequests.length);

	$effect(() => {
		void setTaskbarBadge(homeBadge);
	});

	$effect(() => {
		return () => {
			unread.reset();
			void setTaskbarBadge(0);
		};
	});

	const unreadByFriend = $derived(
		Object.fromEntries(
			friends.flatMap((friend) => {
				const count = friend.channelId ? unread.directCount(friend.channelId) : 0;
				return count > 0 ? [[friend.id, count]] : [];
			})
		)
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
		const channelId = openChatId;
		const oldest = messages[0];
		if (!channelId || !oldest || messagesLoading || !hasMoreMessages) return;

		messagesLoading = true;
		const feed = feedFor(channelId);
		if (feed.localExhausted) {
			await loadOlderFromServer(channelId, oldest.id);
		} else {
			await loadOlderFromDisk(channelId, oldest.id);
		}
		if (openChatId === channelId) messagesLoading = false;
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
		if (openChatId) sendTyping(openChatId);
	});

	$effect(() => {
		void openChatId;
		typingSender.reset();
	});

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

	function handleSend(text: string) {
		const channelId = openChatId;
		if (!channelId || !username) return;
		typingSender.reset();

		const self = members.find((member) => member.id === data.userId);
		const pending: Message = {
			id: `pending:${String(++pendingCounter).padStart(6, '0')}`,
			author: { id: data.userId, username, name: self?.name ?? username },
			text: text.trim(),
			sentAt: new Date(),
			status: 'sending'
		};
		feedFor(channelId).messages.push(pending);
		void deliver(channelId, pending);
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
		const channelId = openChatId;
		const message = channelId && feeds[channelId]?.messages.find((m) => m.id === messageId);
		if (!channelId || !message || message.status !== 'failed') return;
		message.status = 'sending';
		void deliver(channelId, message);
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

	{#if addingFriend}
		<AddFriendDialog {friendIds} onclose={() => (addingFriend = false)} />
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
		{unreadServerIds}
		homeUnread={homeBadge > 0}
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
			<FriendsPanel
				friends={friendsWithPresence}
				requests={friendRequests}
				{freshRequestIds}
				{freshFriendIds}
				selectedFriendId={selectedFriend?.id ?? null}
				{unreadByFriend}
				bind:width={panelWidths.channels}
				onselect={selectFriend}
				onaddfriend={() => (addingFriend = true)}
				onaccept={acceptFriendRequest}
				ondecline={declineFriendRequest}
				onrequestseen={(id) => freshRequestIds.delete(id)}
			/>
		{/if}

		<main class="flex min-w-0 flex-1 flex-col gap-3">
			{#if openChatId}
				{#if selectedChannel}
					<ChatHeader channel={selectedChannel} />
				{:else if selectedFriend}
					<DirectChatHeader friend={selectedFriend} />
				{/if}
				<MessageList
					{messages}
					hasMore={hasMoreMessages}
					loading={messagesLoading}
					typing={typingNames}
					onloadolder={loadOlderMessages}
					onretry={retrySend}
				/>
				{#key openChatId}
					<MessageComposer
						placeholder={composerPlaceholder}
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
					<span class="text-[13px] text-muted">Выберите друга, чтобы начать переписку</span>
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
