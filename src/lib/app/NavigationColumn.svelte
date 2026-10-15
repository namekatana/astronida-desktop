<script lang="ts">
	import ChannelPanel from '$lib/channels/ChannelPanel.svelte';
	import { acceptFriendRequest, declineFriendRequest } from '$lib/friends/channel';
	import FriendsPanel from '$lib/friends/FriendsPanel.svelte';
	import { prefetchInviteLink } from '$lib/invites/invites';
	import { panelWidths } from '$lib/ui/panel-widths.svelte';
	import { appContext } from './context';

	const { app, overlays, profiles, moderation } = appContext();
	const { friends, conversations } = app;
</script>

{#if app.selectedServer}
	{@const server = app.selectedServer}
	<ChannelPanel
		serverName={server.name}
		categories={app.categories}
		channels={app.channels}
		selectedChannelId={app.selectedChannelId}
		voiceOccupants={app.occupants.byChannel}
		loading={app.channelsLoading}
		bind:width={panelWidths.channels}
		onselect={app.selectChannel}
		onprefetch={app.prefetchChannel}
		oncreatecategory={() => overlays.open({ kind: 'create-channel', channelKind: 'category' })}
		oncreatechannel={(kind) => overlays.open({ kind: 'create-channel', channelKind: kind })}
		oninvite={() => overlays.open({ kind: 'invite' })}
		onprefetchinvite={() => prefetchInviteLink(server.id)}
		onopenprofile={profiles.openProfile}
		moderation={moderation.voiceModeration}
		onopensettings={server.ownerId === app.userId
			? () => overlays.open({ kind: 'server-settings', server })
			: undefined}
	/>
{:else}
	<FriendsPanel
		friends={friends.withPresence}
		conversations={conversations.members}
		requests={friends.requests}
		freshRequestIds={friends.freshRequestIds}
		freshFriendIds={friends.freshFriendIds}
		selectedFriendId={app.selectedFriend?.id ?? null}
		unreadByFriend={{ ...friends.unreadCounts, ...conversations.unreadCounts }}
		activityByFriend={{ ...friends.activity, ...conversations.activity }}
		bind:width={panelWidths.channels}
		onselect={app.selectFriend}
		onprefetch={app.prefetchFriend}
		onmenu={moderation.openFriendMenu}
		onaddfriend={() => overlays.open({ kind: 'add-friend' })}
		onaccept={acceptFriendRequest}
		ondecline={declineFriendRequest}
		onrequestseen={(id) => friends.freshRequestIds.delete(id)}
	/>
{/if}
