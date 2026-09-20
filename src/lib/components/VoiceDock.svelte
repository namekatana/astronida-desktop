<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { IconName } from '$lib/ui/icons';
	import type { VoiceOccupant } from '$lib/voice/occupant';
	import { voice, type VoiceConnection, type VoiceFailure } from '$lib/voice/voice.svelte';
	import { qualityColorClass } from '$lib/voice/quality';
	import AvatarStack from './AvatarStack.svelte';
	import ConnectionDetails from './ConnectionDetails.svelte';
	import Icon from './Icon.svelte';
	import SignalBars from './SignalBars.svelte';

	interface Props {
		occupants?: VoiceOccupant[];
		ondisconnect?: () => void;
	}

	let { occupants = [], ondisconnect }: Props = $props();

	const connected = $derived(voice.connected !== null);

	function disconnect() {
		voice.disconnect();
		ondisconnect?.();
	}

	let detailsOpen = $state(false);
	let detailsAnchor = $state<HTMLButtonElement | null>(null);
	let shown = $state<VoiceConnection | null>(null);
	let shownOccupants = $state<VoiceOccupant[]>([]);
	$effect(() => {
		if (voice.connected) {
			shown = voice.connected;
			shownOccupants = occupants;
		}
	});
	$effect(() => {
		if (voice.status !== 'connected') detailsOpen = false;
	});

	const failureLabels: Record<VoiceFailure, string> = {
		duplicate: 'Уже в этом канале из другого окна',
		removed: 'Отключён от канала',
		error: 'Не удалось подключиться'
	};

	const statusLabel = $derived(
		voice.status === 'connecting'
			? 'Подключаюсь…'
			: voice.status === 'reconnecting'
				? 'Переподключение…'
				: voice.status === 'failed'
					? failureLabels[voice.failure ?? 'error']
					: 'Подключено'
	);
	const statusColor = $derived(
		voice.status === 'connected'
			? 'text-online'
			: voice.status === 'failed'
				? 'text-danger'
				: 'text-muted'
	);
	const dotPulse = $derived(voice.status === 'connecting' || voice.status === 'reconnecting');

	const rtt = $derived(
		voice.stats?.rttMs === null || voice.stats?.rttMs === undefined
			? null
			: Math.max(1, voice.stats.rttMs)
	);
	const rttColor = $derived(
		voice.quality === null ? 'text-muted' : qualityColorClass(voice.quality)
	);
</script>

{#snippet toggle(icon: IconName, label: string, off: boolean, onclick: () => void)}
	<button
		type="button"
		aria-label={label}
		aria-pressed={off}
		{onclick}
		class="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 {off
			? 'bg-surface-raised text-ink'
			: 'text-muted hover:bg-white/[0.06] hover:text-ink'}"
	>
		<Icon name={icon} size={18} />
		{#if off}
			<svg
				width="18"
				height="18"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.33"
				stroke-linecap="round"
				aria-hidden="true"
				class="absolute"
			>
				<path d="M3 3l10 10" class="stroke-surface-raised" stroke-width="4" />
				<path d="M3 3l10 10" />
			</svg>
		{/if}
	</button>
{/snippet}

<div class="panel relative shrink-0 px-4 py-3">
	<div class="collapsible {connected ? 'is-open' : ''}" inert={!connected}>
		<div>
			<div class="flex items-end gap-3 pb-2.5">
				<div class="min-w-0 flex-1">
					<div class="flex h-6 items-center gap-2">
						<div
							class="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-medium tracking-[0.1em] uppercase transition-colors duration-200 {statusColor}"
						>
							<Icon
								name="voice"
								size={14}
								class="{voice.status === 'connected' ? 'voice-live' : ''} {dotPulse
									? 'animate-pulse'
									: ''}"
							/>
							<span class="min-w-0 truncate">{statusLabel}</span>
						</div>
						{#if voice.status === 'connected'}
							<button
								bind:this={detailsAnchor}
								type="button"
								aria-label="Сведения о соединении"
								aria-haspopup="dialog"
								aria-expanded={detailsOpen}
								onclick={() => (detailsOpen = !detailsOpen)}
								class="ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] whitespace-nowrap transition-colors duration-200 {detailsOpen
									? 'bg-white/[0.08]'
									: 'bg-white/[0.04] hover:bg-white/[0.08]'}"
							>
								<span class="flex items-center gap-1.5 {rttColor}">
									{#if voice.quality !== null}
										<SignalBars quality={voice.quality} />
									{/if}
									<span class="tabular-nums">{rtt === null ? '—' : `${rtt} мс`}</span>
								</span>
								<span class="flex text-muted">
									<Icon name="lock" size={11} />
								</span>
							</button>
						{/if}
					</div>
					<div class="mt-0.5 truncate text-[13px] font-medium text-ink">{shown?.channelName ?? ''}</div>
					<div class="truncate text-[12px] text-muted">{shown?.serverName ?? ''}</div>
				</div>
				{#if shownOccupants.length > 0}
					<div class="shrink-0 pb-0.5">
						<AvatarStack members={shownOccupants} />
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex h-9 items-center justify-between gap-3">
		<div class="grid min-w-0 flex-1 items-center">
			{#key connected}
				<div
					class="col-start-1 row-start-1 flex min-w-0 items-center"
					in:fade={{ duration: 200, delay: 120 }}
					out:fade={{ duration: 120 }}
				>
					{#if connected}
						<button
							type="button"
							aria-label="Отключиться"
							onclick={disconnect}
							class="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-danger"
						>
							<Icon name="phone-off" size={18} />
						</button>
					{:else}
						<span class="min-w-0 truncate text-[12px] text-muted">Голос не подключён</span>
					{/if}
				</div>
			{/key}
		</div>
		<div class="flex shrink-0 items-center gap-1">
			{@render toggle('mic', 'Микрофон', voice.micMuted, voice.toggleMic)}
			{@render toggle('headphones', 'Наушники', voice.deafened, voice.toggleDeafen)}
		</div>
	</div>

	{#if detailsOpen}
		<ConnectionDetails anchor={detailsAnchor} onclose={() => (detailsOpen = false)} />
	{/if}
</div>
