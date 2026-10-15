<script lang="ts">
	import { createAppState } from '$lib/app/app-state.svelte';
	import ChatColumn from '$lib/app/ChatColumn.svelte';
	import { setAppContext } from '$lib/app/context';
	import { createModerationActions } from '$lib/app/moderation-actions';
	import NavigationColumn from '$lib/app/NavigationColumn.svelte';
	import OverlayHost from '$lib/app/OverlayHost.svelte';
	import { createOverlays } from '$lib/app/overlays.svelte';
	import { createProfileActions } from '$lib/app/profile-actions.svelte';
	import SideColumn from '$lib/app/SideColumn.svelte';
	import ServerBar from '$lib/servers/ServerBar.svelte';
	import { theme } from '$lib/ui/theme.svelte';
	import { windowTitle } from '$lib/ui/title.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	theme.enter('app');

	const overlays = createOverlays();
	// svelte-ignore state_referenced_locally
	const app = createAppState({ data, overlays });
	const profiles = createProfileActions({ app, overlays });
	const moderation = createModerationActions({ app, overlays });
	setAppContext({ app, overlays, profiles, moderation });

	const { menu } = app;

	$effect(() => {
		windowTitle.set(
			app.selectedServer
				? app.selectedServer.name
				: app.selectedFriend
					? `@${app.selectedFriend.username}`
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

	function handleEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		if (menu.editing) {
			menu.cancelEdit();
			return;
		}
		if (menu.reply) {
			menu.clearReply();
			return;
		}
		if (profiles.sideTarget) {
			profiles.closeSideProfile();
			return;
		}
		app.closeDirectChat();
	}
</script>

<svelte:window onkeydown={handleEscape} onpagehide={app.savePresenceOnLeave} />

<div class="relative flex h-full flex-col">
	{#if veilVisible}
		<div
			aria-hidden="true"
			onanimationend={() => (veilVisible = false)}
			class="pointer-events-none absolute inset-0 z-50 bg-bg {painted ? 'anim-veil' : ''}"
		></div>
	{/if}

	<OverlayHost />

	<ServerBar
		servers={app.servers}
		selectedId={app.selectedServerId}
		userId={app.userId}
		avatarId={app.avatarId}
		username={app.username}
		unreadServerIds={app.unreadServerIds}
		homeUnread={app.incoming.homeBadge > 0}
		onselect={(id) => app.selectServer(id)}
		onhome={() => app.selectServer(null)}
		oncreate={() => overlays.open({ kind: 'add-server', view: 'create', value: '' })}
		onsettings={() => overlays.open({ kind: 'settings' })}
		onprofile={(source) => profiles.openProfile(app.selfProfile(), source)}
	/>

	<div class="flex min-h-0 flex-1 gap-3 p-3">
		<NavigationColumn />
		<ChatColumn />
		<SideColumn />
	</div>
</div>
