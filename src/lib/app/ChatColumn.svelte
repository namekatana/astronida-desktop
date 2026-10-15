<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import HomeEmptyState from '$lib/friends/HomeEmptyState.svelte';
	import ChatHeader from '$lib/messages/ChatHeader.svelte';
	import DirectChatHeader from '$lib/messages/DirectChatHeader.svelte';
	import MessageComposer from '$lib/messages/MessageComposer.svelte';
	import MessageList from '$lib/messages/MessageList.svelte';
	import type { Message } from '$lib/messages/messages';
	import MessageSkeleton from '$lib/messages/MessageSkeleton.svelte';
	import PinnedBar from '$lib/messages/PinnedBar.svelte';
	import PinnedToggle from '$lib/messages/PinnedToggle.svelte';
	import { typingIn, typingUsername } from '$lib/messages/typing.svelte';
	import DashedFrame from '$lib/ui/DashedFrame.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Toaster from '$lib/ui/Toaster.svelte';
	import { appContext } from './context';

	const { app, overlays, profiles, moderation } = appContext();
	const { openChat, pins, menu } = app;

	let messageList = $state<ReturnType<typeof MessageList>>();
	let revealingPin = $state(false);
	let draggingFiles = $state(false);
	let dragDepth = 0;

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

	function editLastOwnMessage() {
		const last = openChat.messages.findLast(
			(message) =>
				message.author.id === app.userId && message.status === undefined && !message.forwardedFrom
		);
		if (last) menu.startEdit(last);
	}

	function usernameOf(userId: string): string | undefined {
		if (app.selectedFriend?.id === userId) return app.selectedFriend.username;
		return undefined;
	}

	const typingNames = $derived.by(() => {
		if (!app.openChatId) return [];
		const chatId = app.openChatId;
		return typingIn(chatId)
			.map((userId) => typingUsername(chatId, userId) ?? usernameOf(userId))
			.filter((name): name is string => name !== undefined);
	});

	const composerPlaceholder = $derived(
		app.selectedChannel
			? `Написать в ${app.selectedChannel.name}`
			: app.selectedFriend
				? `Написать @${app.selectedFriend.username}`
				: ''
	);

	function openPhotoSheet(files: File[]) {
		if (overlays.find('send-photos')) return;
		overlays.open({ kind: 'send-photos', files, caption: app.composer?.takeText() ?? '' });
	}

	function openPhoto(message: Message, index: number, element: HTMLElement) {
		overlays.open({
			kind: 'photo-viewer',
			message,
			index,
			origin: element.getBoundingClientRect()
		});
	}

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
		app.composer?.attach([...(event.dataTransfer?.files ?? [])]);
	}

	function cancelSend(messageId: string) {
		if (app.openChatId) app.sending.cancel(app.openChatId, messageId);
	}
</script>

<main
	class="relative flex min-w-0 flex-1 flex-col gap-3"
	ondragenter={app.openChatId ? handleDragEnter : undefined}
	ondragover={app.openChatId ? handleDragOver : undefined}
	ondragleave={app.openChatId ? handleDragLeave : undefined}
	ondrop={app.openChatId ? handleDrop : undefined}
>
	{#if app.openChatId && draggingFiles}
		<div
			transition:fade={{ duration: 150 }}
			class="panel-deep pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2"
		>
			<DashedFrame radius={18} strokeWidth={2} dash={6} class="text-tint/20" />
			<Icon name="image" size={28} class="text-ink-secondary" />
			<p class="text-[15px] font-semibold text-ink">Отпустите, чтобы прикрепить фото</p>
			<p class="text-[13px] text-muted">До 10 фото в одном сообщении</p>
		</div>
	{/if}
	{#if app.openChatId}
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
		{#if app.selectedChannel}
			<ChatHeader channel={app.selectedChannel} trailing={pinnedToggle} />
		{:else if app.selectedFriend}
			<DirectChatHeader
				friend={app.selectedFriend}
				trailing={pinnedToggle}
				onopenprofile={(source) =>
					app.selectedFriend && profiles.openProfile(app.selectedFriend, source)}
			/>
		{/if}
		<MessageList
			bind:this={messageList}
			top={pinnedBar}
			pinnedIds={pins.pinnedIds}
			onpin={app.canPin ? pins.toggle : undefined}
			oncopy={menu.copy}
			ondelete={menu.startDelete}
			onsavephoto={menu.savePhoto}
			onsaveallphotos={menu.saveAllPhotos}
			canDeleteOthers={app.canDeleteOthers}
			messages={openChat.messages}
			selfId={app.userId}
			hasMore={openChat.hasMore}
			loading={openChat.loading}
			typing={typingNames}
			dividerId={openChat.dividerId}
			onloadolder={openChat.loadOlder}
			oncancel={cancelSend}
			onreply={menu.startReply}
			onedit={menu.startEdit}
			onforward={menu.startForward}
			onjoinedinvite={app.handleServerJoined}
			onopeninvite={app.openInvite}
			profileLinks={app.selectedChannel ? undefined : profiles.linkHandlers}
			onopenphoto={openPhoto}
			onopenprofile={profiles.openProfile}
			onauthormenu={app.selectedChannel ? moderation.openMemberMenu : undefined}
		/>
		{#key app.openChatId}
			<MessageComposer
				bind:this={app.composer}
				placeholder={composerPlaceholder}
				reply={menu.reply}
				onsend={app.handleSend}
				onattach={openPhotoSheet}
				ontyping={openChat.touchTyping}
				oncancelreply={menu.clearReply}
				editing={menu.editing}
				onsaveedit={menu.saveEdit}
				oncanceledit={menu.cancelEdit}
				onrequestedit={editLastOwnMessage}
			/>
		{/key}
	{:else if app.selectedServer && app.channelsLoading}
		{#if app.chatSkeleton}
			<div aria-hidden="true" class="flex min-h-0 flex-1 flex-col gap-3" in:fade={{ duration: 150 }}>
				<div class="panel flex shrink-0 items-center gap-2.5 px-5 py-3.5">
					<span class="skeleton h-4 w-4 rounded-[5px]"></span>
					<span class="skeleton my-[7px] h-2.5 w-32 rounded-full"></span>
				</div>
				<div class="panel-deep flex min-h-0 flex-1 flex-col justify-end px-2 pt-3 pb-7">
					<MessageSkeleton />
				</div>
				<div class="panel h-14 shrink-0 rounded-[28px] [corner-shape:round]"></div>
			</div>
		{/if}
	{:else if app.selectedServer}
		<div class="flex flex-1 items-center justify-center">
			<span class="text-[13px] text-muted">Создай первый канал — через «⋯» у названия сервера</span>
		</div>
	{:else}
		<div class="relative flex flex-1 items-center justify-center">
			<HomeEmptyState />
			<Toaster />
		</div>
	{/if}
</main>
