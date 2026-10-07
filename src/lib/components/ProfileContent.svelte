<script lang="ts">
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { ownStatus } from '$lib/presence/own-status.svelte';
	import type { ProfileCard, ProfileEditing, ProfileRelation } from '$lib/profile/profile';
	import { widgetTileClass } from '$lib/profile/widget-tile';
	import type { Server } from '$lib/servers/servers';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import type { IconName } from '$lib/ui/icons';
	import { initials } from '$lib/ui/initials';
	import { materialize } from '$lib/ui/materialize';
	import { settle } from '$lib/ui/settle';
	import DrawnCheck from './DrawnCheck.svelte';
	import Icon from './Icon.svelte';
	import Orbit from './Orbit.svelte';
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
		messageError?: string | null;
	}

	let {
		card,
		cometDelay,
		animated,
		editing = null,
		onopenserver,
		onmessage,
		messageBusy = false,
		messageError = null
	}: Props = $props();

	let avatar = $state<ReturnType<typeof ProfileAvatar>>();

	const messageSpinnerDelayMs = 150;
	const messageSpinner = createDelayedFlag(() => messageBusy, messageSpinnerDelayMs);

	export function showStatusNow() {
		avatar?.showStatusNow();
	}

	const friendActions: Partial<Record<ProfileRelation, { label: string; icon: IconName }>> = {
		incoming: { label: 'Принять запрос', icon: 'user-check' },
		none: { label: 'Добавить в друзья', icon: 'user-plus' }
	};

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
	<h2
		class="mt-3 max-w-full truncate px-6 text-[22px] leading-7 font-bold tracking-[-0.015em] text-ink transition-opacity duration-200 ease-soft {editing
			? 'opacity-40'
			: ''}"
	>
		@{card.target.username}
	</h2>

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
			{@const friendAction = friendActions[card.relation]}
			<div class="mt-4 flex items-center gap-2">
				{#if onmessage}
					<button
						type="button"
						disabled={messageBusy}
						onclick={onmessage}
						class="pressable flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-bg duration-150 hover:bg-ink-hover disabled:opacity-50"
					>
						<span class="grid h-4 w-4 place-items-center">
							{#if messageSpinner.current}
								<Orbit size={16} class="col-start-1 row-start-1" />
							{:else}
								<Icon name="text" size={15} class="col-start-1 row-start-1" />
							{/if}
						</span>
						Написать
					</button>
				{/if}
				{#if friendAction}
					<button
						type="button"
						aria-label={friendAction.label}
						title={friendAction.label}
						class="pressable flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-ink duration-150 hover:bg-white/[0.12]"
					>
						<Icon name={friendAction.icon} size={16} />
					</button>
				{/if}
				<button
					type="button"
					aria-label="Ещё"
					class="pressable flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-ink duration-150 hover:bg-white/[0.12]"
				>
					<Icon name="dots" size={16} />
				</button>
			</div>
			<div class="collapsible {messageError ? 'is-open' : ''}" inert={!messageError}>
				<div>
					<p class="px-4 pt-2 text-center text-[12px] leading-4 text-danger">{messageError ?? ''}</p>
				</div>
			</div>
		{/if}
	</div>

	<div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-2.5">
		<ProfileWidgets bio={card.bio} widgets={card.widgets} {editing} {onopenserver} />

		{#if card.mutualServers.length > 0}
			<section class="min-w-0 px-3.5 pt-3 pb-3.5 {widgetTileClass}">
				<h3 class="flex h-5 items-center gap-1.5 text-[12px] font-semibold text-ink-secondary">
					<Icon name="users" size={13} class="text-muted" />
					Общие серверы — {card.mutualServers.length}
				</h3>
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each card.mutualServers as server (server.id)}
						<span
							class="flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-white/[0.05] pr-2.5 pl-[3px] text-[12px] text-ink-secondary"
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
