<script lang="ts">
	import type { Channel } from '$lib/channels/channels';
	import { initials } from '$lib/ui/initials';
	import type { VoiceOccupant } from '$lib/voice/occupant';
	import { describeStats } from '$lib/voice/quality';
	import Icon from './Icon.svelte';
	import SignalBars from './SignalBars.svelte';
	import StrikedIcon from './StrikedIcon.svelte';
	import OccupantMenu from './OccupantMenu.svelte';
	import { participantAudio } from '$lib/voice/volumes.svelte';
	import { unread } from '$lib/notifications/unread.svelte';
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		channel: Channel;
		active?: boolean;
		occupants?: VoiceOccupant[];
		onclick?: () => void;
		onprefetch?: () => void;
		element?: HTMLButtonElement;
	}

	let {
		channel,
		active = false,
		occupants = [],
		onclick,
		onprefetch,
		element = $bindable()
	}: Props = $props();

	const occupied = $derived(occupants.length > 0);
	const hasUnread = $derived(!active && unread.hasChannel(channel.id));

	let shown = $state<VoiceOccupant[]>([]);
	$effect(() => {
		if (occupants.length > 0) shown = occupants;
	});

	let menu = $state<{ occupant: VoiceOccupant; x: number; y: number } | null>(null);

	function openMenu(event: MouseEvent, occupant: VoiceOccupant) {
		if (occupant.self) return;
		event.preventDefault();
		menu = { occupant, x: event.clientX, y: event.clientY };
	}

	$effect(() => {
		if (menu && !occupants.some((occupant) => occupant.id === menu?.occupant.id)) menu = null;
	});
</script>

<div>
	<button
		bind:this={element}
		type="button"
		aria-pressed={active}
		{onclick}
		onmouseenter={onprefetch}
		onfocus={onprefetch}
		class="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-150 {active ||
		hasUnread
			? 'text-ink'
			: 'text-ink-secondary hover:bg-white/[0.04] hover:text-ink'} {hasUnread ? 'font-medium' : ''}"
	>
		{#if hasUnread}
			<span
				aria-hidden="true"
				class="absolute top-1/2 -left-2.5 h-2 w-1 -translate-y-1/2 rounded-r-full bg-ink"
				transition:scale={{ start: 0.8, duration: 160, easing: cubicOut }}
			></span>
		{/if}
		<Icon
			name={channel.kind}
			class="transition-colors duration-200 {occupied ? 'voice-live' : ''} {occupied
				? 'text-online'
				: active
					? 'text-ink'
					: 'text-muted'}"
		/>
		<span class="min-w-0 flex-1 truncate">{channel.name}</span>
		{#if occupied}
			<span class="flex shrink-0 items-center gap-1 text-[12px] text-muted tabular-nums">
				<Icon name="users" size={12} />
				{occupants.length}
			</span>
		{/if}
	</button>

	<div class="collapsible relative z-10 {occupied ? 'is-open' : ''}" inert={!occupied}>
		<div>
			<div role="list" class="flex flex-col gap-0.5 pt-0.5 pb-1 pr-2.5 pl-[38px]">
				{#each shown as occupant (occupant.id)}
					<div
						role="listitem"
						oncontextmenu={(event) => openMenu(event, occupant)}
						class="-mx-1.5 flex h-8 items-center gap-2 rounded-md px-1.5 transition-[background-color,opacity] duration-200 hover:bg-white/[0.05] {occupant.quality ===
						'lost'
							? 'opacity-40'
							: ''} {menu?.occupant.id === occupant.id ? 'bg-white/[0.05]' : ''}"
					>
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-ink ring-online transition-shadow duration-150 {occupant.speaking
								? 'ring-2'
								: 'ring-0'}"
						>
							{initials(occupant.name)}
						</span>
						<span class="min-w-0 flex-1 truncate text-[12px] text-ink-secondary">
							@{occupant.username}
						</span>
						{#if !occupant.self && participantAudio.muted(occupant.id)}
							<Icon name="volume-off" size={14} class="shrink-0 text-danger" />
						{/if}
						{#if occupant.quality !== null}
							<SignalBars
								quality={occupant.quality}
								title={describeStats(occupant.stats, occupant.quality)}
							/>
						{/if}
						{#if occupant.micMuted}
							<StrikedIcon name="mic" class="shrink-0 text-muted" />
						{/if}
						{#if occupant.deafened}
							<StrikedIcon name="headphones" class="shrink-0 text-muted" />
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>

	{#if menu}
		<OccupantMenu occupant={menu.occupant} x={menu.x} y={menu.y} onclose={() => (menu = null)} />
	{/if}
</div>
