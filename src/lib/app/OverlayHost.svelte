<script lang="ts">
	import { auth } from '$lib/auth/session.svelte';
	import CreateCategoryDialog from '$lib/channels/CreateCategoryDialog.svelte';
	import CreateChannelDialog from '$lib/channels/CreateChannelDialog.svelte';
	import AddFriendDialog from '$lib/friends/AddFriendDialog.svelte';
	import RemoveFriendDialog from '$lib/friends/RemoveFriendDialog.svelte';
	import InviteDialog from '$lib/invites/InviteDialog.svelte';
	import BanMemberDialog from '$lib/members/BanMemberDialog.svelte';
	import KickMemberDialog from '$lib/members/KickMemberDialog.svelte';
	import MemberMenu from '$lib/members/MemberMenu.svelte';
	import PhotoViewer from '$lib/media/PhotoViewer.svelte';
	import SendPhotosDialog from '$lib/media/SendPhotosDialog.svelte';
	import DeleteMessageDialog from '$lib/messages/DeleteMessageDialog.svelte';
	import ForwardDialog from '$lib/messages/ForwardDialog.svelte';
	import type { Message } from '$lib/messages/messages';
	import ProfileDialog from '$lib/profile/ProfileDialog.svelte';
	import ShareProfileDialog from '$lib/profile/ShareProfileDialog.svelte';
	import AddServerDialog from '$lib/servers/AddServerDialog.svelte';
	import ServerSettingsDialog from '$lib/servers/ServerSettingsDialog.svelte';
	import SettingsDialog from '$lib/settings/SettingsDialog.svelte';
	import { appContext } from './context';

	const { app, overlays, profiles, moderation } = appContext();
	const { menu } = app;

	const serverDialog = $derived(overlays.find('add-server'));
	const viewer = $derived(overlays.find('photo-viewer'));
	const photoSheet = $derived(overlays.find('send-photos'));
	const profile = $derived(overlays.find('profile'));
	const memberMenu = $derived(overlays.find('member-menu'));
	const moderating = $derived(overlays.find('moderation'));
	const serverSettings = $derived(overlays.find('server-settings'));
	const unfriending = $derived(overlays.find('unfriend'));
	const sharingProfile = $derived(overlays.find('share-profile'));
	const channelDialog = $derived(overlays.find('create-channel'));

	function closePhotoSheet(caption: string) {
		app.composer?.restoreText(caption);
	}

	function forwardFromViewer(message: Message) {
		overlays.close('photo-viewer');
		menu.startForward(message);
	}
</script>

{#if serverDialog}
	<AddServerDialog
		initialView={serverDialog.view}
		initialValue={serverDialog.value}
		oncreated={app.handleServerCreated}
		onjoined={app.handleServerJoined}
		onclose={() => overlays.close('add-server')}
	/>
{/if}

{#if overlays.find('add-friend')}
	<AddFriendDialog friendIds={app.friends.ids} onclose={() => overlays.close('add-friend')} />
{/if}

{#if app.selectedServer && overlays.find('invite')}
	<InviteDialog
		serverId={app.selectedServer.id}
		serverName={app.selectedServer.name}
		friends={app.friends.list}
		conversations={app.conversations.visible}
		canManage={app.selectedServer.ownerId === app.userId}
		oninvite={(channelId, link) => app.sending.send(channelId, link)}
		onclose={() => overlays.close('invite')}
	/>
{/if}

{#if overlays.find('settings')}
	<SettingsDialog
		username={app.username}
		email={auth.user?.email ?? null}
		phone={auth.user?.phone || null}
		createdAt={auth.user?.created_at ?? null}
		signingOut={app.signingOut}
		onsignout={app.signOut}
		onclose={() => overlays.close('settings')}
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

{#if memberMenu}
	{@const request = memberMenu.request}
	<MemberMenu
		target={request.target}
		subtitle={moderation.memberMenuSubtitle(request)}
		serverName={moderation.memberMenuServer(request)?.name ?? null}
		x={request.x}
		y={request.y}
		canModerate={moderation.mayModerate(request.serverId, request.target.id)}
		onclose={() => overlays.close('member-menu')}
		onprofile={() => profiles.openProfile(request.target, request.source)}
		onkick={() =>
			request.serverId && moderation.startModeration('kick', request.target, request.serverId)}
		onban={() =>
			request.serverId && moderation.startModeration('ban', request.target, request.serverId)}
		onunfriend={profiles.unfriendActionFor(request.target)}
		onshare={profiles.shareActionFor(request.target)}
	/>
{/if}

{#if sharingProfile}
	<ShareProfileDialog
		target={sharingProfile.target}
		friends={app.friends.withPresence}
		onshare={profiles.shareProfile}
		onclose={() => overlays.close('share-profile')}
	/>
{/if}

{#if unfriending}
	<RemoveFriendDialog
		target={unfriending.target}
		ondone={profiles.finishUnfriend}
		onclose={() => overlays.close('unfriend')}
	/>
{/if}

{#if moderating?.action === 'kick'}
	<KickMemberDialog
		serverId={moderating.serverId}
		serverName={moderating.serverName}
		target={moderating.target}
		ondone={moderation.finishModeration}
		onclose={() => overlays.close('moderation')}
	/>
{:else if moderating?.action === 'ban'}
	<BanMemberDialog
		serverId={moderating.serverId}
		serverName={moderating.serverName}
		target={moderating.target}
		ondone={moderation.finishModeration}
		onclose={() => overlays.close('moderation')}
	/>
{/if}

{#if serverSettings}
	<ServerSettingsDialog
		server={serverSettings.server}
		onclose={() => overlays.close('server-settings')}
	/>
{/if}

{#if photoSheet && app.openChatId}
	<SendPhotosDialog
		files={photoSheet.files}
		caption={photoSheet.caption}
		onsend={app.handleSend}
		onclose={closePhotoSheet}
		onclosed={() => overlays.close('send-photos')}
	/>
{/if}

{#if viewer}
	<PhotoViewer
		message={viewer.message}
		index={viewer.index}
		origin={viewer.origin}
		onnavigate={(index) => viewer && overlays.open({ ...viewer, index, origin: null })}
		onforward={forwardFromViewer}
		onclose={() => overlays.close('photo-viewer')}
	/>
{/if}

{#if profile && profiles.dialogCard}
	<ProfileDialog
		card={profiles.dialogCard}
		source={profile.source}
		onclose={() => overlays.close('profile')}
		onavatarchange={app.changeAvatar}
		onbannerchange={app.changeBanner}
		onbiochange={app.changeBio}
		onwidgetschange={app.changeWidgets}
		ownedServers={app.servers.filter((server) => server.ownerId === app.userId)}
		onopenserver={(server) => {
			overlays.close('profile');
			app.handleServerJoined(server);
		}}
	/>
{/if}

{#if menu.forwarding}
	<ForwardDialog
		message={menu.forwarding.message}
		friends={app.friends.withPresence}
		servers={app.servers}
		workspaces={app.workspaces.all}
		onforward={menu.forwardTo}
		onclose={menu.closeForward}
	/>
{/if}

{#if app.selectedServer}
	{#if channelDialog?.channelKind === 'category'}
		<CreateCategoryDialog
			serverId={app.selectedServer.id}
			serverName={app.selectedServer.name}
			categories={app.categories}
			channels={app.channels}
			oncreated={app.handleCategoryCreated}
			onclose={() => overlays.close('create-channel')}
		/>
	{:else if channelDialog}
		<CreateChannelDialog
			serverId={app.selectedServer.id}
			serverName={app.selectedServer.name}
			initialKind={channelDialog.channelKind}
			categories={app.categories}
			channels={app.channels}
			oncreated={app.handleChannelCreated}
			onclose={() => overlays.close('create-channel')}
		/>
	{/if}
{/if}
