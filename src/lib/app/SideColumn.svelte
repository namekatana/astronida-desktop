<script lang="ts">
	import type { TransitionConfig } from 'svelte/transition';
	import ActiveFriendsPanel from '$lib/friends/ActiveFriendsPanel.svelte';
	import { findActiveFriends } from '$lib/friends/active-friends';
	import MemberPanel from '$lib/members/MemberPanel.svelte';
	import { ownStatus } from '$lib/presence/own-status.svelte';
	import ProfilePanel from '$lib/profile/ProfilePanel.svelte';
	import { panelLimits, panelWidths } from '$lib/ui/panel-widths.svelte';
	import ResizeHandle from '$lib/ui/ResizeHandle.svelte';
	import { settle } from '$lib/ui/settle';
	import VoiceDock from '$lib/voice/VoiceDock.svelte';
	import { appContext } from './context';

	const { app, profiles, moderation } = appContext();

	const sideEnterMs = 150;
	const sideLeaveMs = 100;
	const instant: TransitionConfig = { duration: 0 };

	const activeFriends = $derived(
		findActiveFriends({
			friends: app.friends.withPresence,
			servers: app.servers,
			presenceByServer: app.presence.byServer,
			workspaces: app.workspaces.all
		})
	);

	function enterSideProfile(node: Element): TransitionConfig {
		return settle(node, { duration: sideEnterMs });
	}

	function leaveSideProfile(node: Element): TransitionConfig {
		return profiles.closingInPlace ? settle(node, { duration: sideLeaveMs }) : instant;
	}

	function enterSideList(node: Element): TransitionConfig {
		return profiles.closingInPlace ? settle(node, { duration: sideEnterMs }) : instant;
	}

	function leaveSideList(node: Element): TransitionConfig {
		return profiles.sideTarget ? settle(node, { duration: sideLeaveMs }) : instant;
	}
</script>

<div class="relative flex shrink-0 flex-col gap-3" style="width: {panelWidths.members}px">
	<div class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]">
		<div class="panel col-start-1 row-start-1"></div>
		{#if profiles.sideCard}
			{@const card = profiles.sideCard}
			<div
				class="relative z-10 col-start-1 row-start-1 flex min-h-0 flex-col"
				in:enterSideProfile
				out:leaveSideProfile
			>
				<ProfilePanel
					{card}
					animated
					onback={profiles.closeSideProfile}
					onopenserver={app.handleServerJoined}
					onmessage={() => profiles.messageUser(card.target)}
					messageBusy={profiles.directOpening === card.target.id}
					onfriendaction={() => profiles.befriend(card.target, card.relation)}
					onunfriend={profiles.unfriendActionFor(card.target)}
					onshare={profiles.shareActionFor(card.target)}
					actionError={profiles.errorFor(card.target.id)}
				/>
			</div>
		{:else}
			<div
				class="relative col-start-1 row-start-1 flex min-h-0 flex-col"
				in:enterSideList
				out:leaveSideList
			>
				{#if app.selectedServer}
					{@const server = app.selectedServer}
					{#key server.id}
						<MemberPanel
							serverId={server.id}
							ownerId={server.ownerId}
							selfId={app.userId}
							selfStatus={ownStatus.current}
							preview={app.memberPreviews[server.id] ?? null}
							onpreview={(next) => app.saveMemberPreview(server.id, next)}
							onopenprofile={profiles.openProfile}
							onmembermenu={moderation.openMemberMenu}
						/>
					{/key}
				{:else if profiles.chatPartnerCard}
					{@const card = profiles.chatPartnerCard}
					<ProfilePanel
						{card}
						animated={false}
						onopenserver={app.handleServerJoined}
						onfriendaction={() => profiles.befriend(card.target, card.relation)}
						onunfriend={profiles.unfriendActionFor(card.target)}
						onshare={profiles.shareActionFor(card.target)}
						actionError={profiles.errorFor(card.target.id)}
					/>
				{:else}
					<ActiveFriendsPanel active={activeFriends} onopenprofile={profiles.openProfile} />
				{/if}
			</div>
		{/if}
	</div>
	<VoiceDock occupants={app.occupants.participants} ondisconnect={app.handleVoiceDisconnect} />
	<ResizeHandle
		side="left"
		bind:width={panelWidths.members}
		min={panelLimits.min}
		max={panelLimits.max}
	/>
</div>
