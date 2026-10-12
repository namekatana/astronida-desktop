<script lang="ts">
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { ownStatus } from '$lib/presence/own-status.svelte';
	import type { ProfileCard, ProfileEditing, ProfileRelation } from '$lib/profile/profile';
	import { widgetTileClass } from '$lib/profile/widget-tile';
	import type { Server } from '$lib/servers/servers';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import { initials } from '$lib/ui/initials';
	import { materialize } from '$lib/ui/materialize';
	import { settle } from '$lib/ui/settle';
	import DrawnCheck from './DrawnCheck.svelte';
	import Icon from './Icon.svelte';
	import Orbit from './Orbit.svelte';
	import ProfileActionsMenu from './ProfileActionsMenu.svelte';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import ProfileBanner from './ProfileBanner.svelte';
	import ProfileWidgets from './ProfileWidgets.svelte';
	import StatusPicker from './StatusPicker.svelte';

	interface Props {
		card: ProfileCard;
		cometDelay: number | null;
		animated: boolean;
		editing?: ProfileEditing | null;
		onopenserver?: (server: Server) => void;
		onmessage?: () => void;
		messageBusy?: boolean;
		onfriendaction?: () => Promise<boolean>;
		onunfriend?: () => void;
		onshare?: () => void;
		actionError?: string | null;
	}

	let {
		card,
		cometDelay,
		animated,
		editing = null,
		onopenserver,
		onmessage,
		messageBusy = false,
		onfriendaction,
		onunfriend,
		onshare,
		actionError = null
	}: Props = $props();

	let avatar = $state<ReturnType<typeof ProfileAvatar>>();

	const spinnerDelayMs = 150;
	const messageSpinner = createDelayedFlag(() => messageBusy, spinnerDelayMs);

	let friendBusy = $state(false);
	const friendSpinner = createDelayedFlag(() => friendBusy, spinnerDelayMs);

	let actionsAnchor = $state<HTMLButtonElement | null>(null);
	let actionsOpen = $state(false);

	export function showStatusNow() {
		avatar?.showStatusNow();
	}

	const friendActions: Partial<Record<ProfileRelation, 'add' | 'accept' | 'sent'>> = {
		none: 'add',
		incoming: 'accept',
		outgoing: 'sent'
	};

	const friendAction = $derived(onfriendaction ? (friendActions[card.relation] ?? null) : null);
	const unfriend = $derived(card.relation === 'friend' ? onunfriend : undefined);
	const hasActions = $derived(
		card.relation !== 'self' &&
			(onmessage !== undefined ||
				friendAction !== null ||
				onshare !== undefined ||
				unfriend !== undefined)
	);
	const actionsBusy = $derived(messageSpinner.current || friendSpinner.current);

	async function runFriendAction() {
		if (!onfriendaction || friendBusy || friendAction === 'sent') return;
		friendBusy = true;
		await onfriendaction();
		friendBusy = false;
	}

	const still: TransitionConfig = { duration: 0 };

	const noticeColors: Record<ProfileEditing['noticeTone'], string> = {
		hint: 'text-muted',
		danger: 'text-danger',
		done: 'text-ink-secondary'
	};

	function bannerIn(node: Element): TransitionConfig {
		return animated ? fade(node, { duration: 220 }) : still;
	}

	function bannerOut(node: Element): TransitionConfig {
		return animated ? fade(node, { duration: 100 }) : still;
	}

	function bodyIn(node: Element): TransitionConfig {
		return animated ? { ...materialize(node, { blur: 4, duration: 280 }), delay: 140 } : still;
	}

	function bodyOut(node: Element): TransitionConfig {
		return animated ? fade(node, { duration: 120 }) : still;
	}
</script>

<div class="w-full" in:bannerIn out:bannerOut>
	<ProfileBanner
		userId={card.target.id}
		bannerId={card.bannerId}
		preview={editing?.banner}
		onpick={editing?.onbannerclick}
	/>
</div>

<div class="pointer-events-none -mt-11">
	<ProfileAvatar
		bind:this={avatar}
		userId={card.target.id}
		avatarId={card.avatarId}
		name={card.target.name}
		online={card.online && !editing}
		status={card.status}
		{cometDelay}
		preview={editing?.avatar}
		onpick={editing?.onavatarclick}
	/>
</div>

<div class="flex w-full flex-col items-center px-2.5" in:bodyIn out:bodyOut>
	{#if hasActions}
		<div class="mt-2.5 flex max-w-full min-w-0 justify-center px-4">
			<button
				bind:this={actionsAnchor}
				type="button"
				aria-label="@{card.target.username} — действия с профилем"
				aria-haspopup="menu"
				aria-expanded={actionsOpen}
				aria-busy={actionsBusy}
				onclick={() => (actionsOpen = !actionsOpen)}
				class="group/name flex max-w-full min-w-0 items-center gap-1 rounded-full py-0.5 pr-2.5 pl-3.5 transition-colors duration-150 hover:bg-tint/[0.05] {actionsOpen
					? 'bg-tint/[0.05]'
					: ''}"
			>
				<span
					class="min-w-0 truncate text-[22px] leading-7 font-bold tracking-[-0.015em] text-ink"
				>
					@{card.target.username}
				</span>
				<span
					class="grid h-4 w-4 shrink-0 place-items-center transition-colors duration-150 group-hover/name:text-ink-secondary {actionsOpen
						? 'text-ink-secondary'
						: 'text-muted'}"
				>
					{#key actionsBusy}
						<span class="col-start-1 row-start-1 flex" in:settle out:settle={{ duration: 100 }}>
							{#if actionsBusy}
								<Orbit size={14} />
							{:else}
								<Icon
									name="chevron"
									size={14}
									class="transition-transform duration-200 ease-soft {actionsOpen
										? 'rotate-180'
										: ''}"
								/>
							{/if}
						</span>
					{/key}
				</span>
			</button>
		</div>
	{:else}
		<h2
			class="mt-3 max-w-full truncate px-6 text-[22px] leading-7 font-bold tracking-[-0.015em] text-ink transition-opacity duration-200 ease-soft {editing
				? 'opacity-40'
				: ''}"
		>
			@{card.target.username}
		</h2>
	{/if}

	{#if actionsOpen && actionsAnchor && hasActions}
		<ProfileActionsMenu
			anchor={actionsAnchor}
			{friendAction}
			{onmessage}
			onfriendaction={runFriendAction}
			{onshare}
			onunfriend={unfriend}
			onclose={() => (actionsOpen = false)}
		/>
	{/if}

	{#if card.relation === 'self'}
		<div class="mt-2 grid justify-items-center">
			<div
				inert={editing !== null}
				class="col-start-1 row-start-1 transition-[opacity,filter] duration-200 ease-soft {editing
					? 'opacity-0 blur-[2px]'
					: ''}"
			>
				<StatusPicker status={card.status} onchoose={(status) => ownStatus.choose(status)} />
			</div>
			<div
				aria-live="polite"
				class="col-start-1 row-start-1 grid h-7 grid-cols-1 items-center justify-items-center text-[13px] transition-[opacity,filter] duration-200 ease-soft {editing
					? ''
					: 'opacity-0 blur-[2px]'}"
			>
				{#key `${editing?.noticeTone}:${editing?.notice}`}
					<p
						class="col-start-1 row-start-1 flex items-center gap-1.5 {noticeColors[
							editing?.noticeTone ?? 'hint'
						]}"
						in:settle
						out:settle={{ duration: 100 }}
					>
						{#if editing?.noticeTone === 'done'}
							<DrawnCheck size={14} />
						{/if}
						{editing?.notice ?? ''}
					</p>
				{/key}
			</div>
		</div>
	{/if}

	<div
		inert={editing !== null}
		class="flex w-full flex-col items-center transition-opacity duration-200 ease-soft {editing
			? 'opacity-40'
			: ''}"
	>
		{#if card.voice}
			<p
				class="mt-1 flex h-5 max-w-full min-w-0 items-center gap-1.5 px-6 text-[13px] text-ink-secondary"
			>
				<Icon name="voice" size={14} class="text-online" />
				<span class="truncate">{card.voice.channelName} · {card.voice.serverName}</span>
			</p>
		{/if}

		{#if card.relation !== 'self'}
			<div class="collapsible {actionError ? 'is-open' : ''}" inert={!actionError}>
				<div class="grid">
					{#key actionError}
						<p
							in:settle
							class="col-start-1 row-start-1 px-4 pt-2 text-center text-[12px] leading-4 text-danger"
						>
							{actionError ?? ''}
						</p>
					{/key}
				</div>
			</div>
		{/if}
	</div>

	<div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-2.5">
		<ProfileWidgets
			bio={card.bio}
			widgets={card.widgets}
			{editing}
			ownerId={card.target.id}
			{onopenserver}
		/>

		{#if card.mutualServers.length > 0}
			<section class="min-w-0 px-3.5 pt-3 pb-3.5 {widgetTileClass}">
				<h3 class="flex h-5 items-center gap-1.5 text-[12px] font-semibold text-ink-secondary">
					<Icon name="users" size={13} class="text-muted" />
					Общие серверы — {card.mutualServers.length}
				</h3>
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each card.mutualServers as server (server.id)}
						<span
							class="flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-tint/[0.05] pr-2.5 pl-[3px] text-[12px] text-ink-secondary"
						>
							<span
								class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-surface-raised text-[9px] font-semibold text-ink"
							>
								{initials(server.name)}
							</span>
							<span class="truncate">{server.name}</span>
						</span>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>
