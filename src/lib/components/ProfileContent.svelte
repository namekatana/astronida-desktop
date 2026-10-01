<script lang="ts">
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { ownStatus } from '$lib/presence/own-status.svelte';
	import type { ProfileCard, ProfileRelation } from '$lib/profile/profile';
	import type { IconName } from '$lib/ui/icons';
	import { initials } from '$lib/ui/initials';
	import { materialize } from '$lib/ui/materialize';
	import Icon from './Icon.svelte';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import StatusPicker from './StatusPicker.svelte';

	interface Props {
		card: ProfileCard;
		cometDelay: number | null;
		animated: boolean;
	}

	let { card, cometDelay, animated }: Props = $props();

	let avatar = $state<ReturnType<typeof ProfileAvatar>>();

	export function showStatusNow() {
		avatar?.showStatusNow();
	}

	const primaryActions: Record<Exclude<ProfileRelation, 'self'>, { label: string; icon: IconName }> =
		{
			friend: { label: 'Написать', icon: 'text' },
			incoming: { label: 'Принять запрос', icon: 'user-check' },
			none: { label: 'Добавить в друзья', icon: 'user-plus' }
		};

	const still: TransitionConfig = { duration: 0 };

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

{#snippet action(label: string, icon: IconName | null, primary: boolean)}
	<button
		type="button"
		class="pressable flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold duration-150 {primary
			? 'bg-ink text-bg hover:bg-ink-hover'
			: 'bg-white/[0.08] text-ink hover:bg-white/[0.12]'}"
	>
		{#if icon}
			<Icon name={icon} size={15} />
		{/if}
		{label}
	</button>
{/snippet}

<div
	class="h-24 w-full shrink-0 rounded-[12px] bg-white/[0.06] [corner-shape:squircle]"
	in:bannerIn
	out:bannerOut
></div>

<div class="-mt-11">
	<ProfileAvatar
		bind:this={avatar}
		name={card.target.name}
		online={card.online}
		status={card.status}
		{cometDelay}
	/>
</div>

<div class="flex w-full flex-col items-center px-2.5" in:bodyIn out:bodyOut>
	<h2
		class="mt-3 max-w-full truncate px-6 text-[22px] leading-7 font-bold tracking-[-0.015em] text-ink"
	>
		@{card.target.username}
	</h2>

	{#if card.relation === 'self'}
		<div class="mt-2">
			<StatusPicker status={card.status} onchoose={(status) => ownStatus.choose(status)} />
		</div>
	{/if}

	{#if card.voice}
		<p
			class="mt-1 flex h-5 max-w-full min-w-0 items-center gap-1.5 px-6 text-[13px] text-ink-secondary"
		>
			<Icon name="voice" size={14} class="text-online" />
			<span class="truncate">{card.voice.channelName} · {card.voice.serverName}</span>
		</p>
	{/if}

	<div class="mt-4 flex items-center gap-2">
		{#if card.relation === 'self'}
			{@render action('Изменить профиль', null, false)}
		{:else}
			{@const primary = primaryActions[card.relation]}
			{@render action(primary.label, primary.icon, true)}
			<button
				type="button"
				aria-label="Ещё"
				class="pressable flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-ink duration-150 hover:bg-white/[0.12]"
			>
				<Icon name="dots" size={16} />
			</button>
		{/if}
	</div>

	<div class="mt-5 grid w-full gap-2">
		<section class="rounded-[14px] bg-white/[0.05] px-3.5 py-3 [corner-shape:squircle]">
			<h3 class="text-[12px] font-semibold text-muted">О себе</h3>
			<p class="mt-1 text-[13px] text-muted">Описание пусто</p>
		</section>

		{#if card.mutualServers.length > 0}
			<section class="rounded-[14px] bg-white/[0.05] px-3.5 py-3 [corner-shape:squircle]">
				<h3 class="text-[12px] font-semibold text-muted">
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
