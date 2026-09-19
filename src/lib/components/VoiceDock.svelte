<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Member } from '$lib/servers/members';
	import type { IconName } from '$lib/ui/icons';
	import { voice, type VoiceConnection } from '$lib/voice/voice.svelte';
	import AvatarStack from './AvatarStack.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		occupants?: Member[];
		ondisconnect?: () => void;
	}

	let { occupants = [], ondisconnect }: Props = $props();

	const connected = $derived(voice.connected !== null);

	function disconnect() {
		voice.disconnect();
		ondisconnect?.();
	}

	let shown = $state<VoiceConnection | null>(null);
	let shownOccupants = $state<Member[]>([]);
	$effect(() => {
		if (voice.connected) {
			shown = voice.connected;
			shownOccupants = occupants;
		}
	});

	const statusLabel = $derived(
		voice.status === 'connecting'
			? 'Подключаюсь…'
			: voice.status === 'failed'
				? 'Не удалось подключиться'
				: 'Подключено'
	);
	const statusColor = $derived(
		voice.status === 'connected'
			? 'text-online'
			: voice.status === 'failed'
				? 'text-danger'
				: 'text-muted'
	);
	const dotColor = $derived(
		voice.status === 'connected'
			? 'bg-online'
			: voice.status === 'failed'
				? 'bg-danger'
				: 'bg-muted'
	);
	const pingColor = $derived(
		voice.ping === null
			? 'text-muted'
			: voice.ping < 100
				? 'text-online'
				: voice.ping < 200
					? 'text-muted'
					: 'text-danger'
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

<div class="panel shrink-0 px-4 py-3">
	<div class="collapsible {connected ? 'is-open' : ''}" inert={!connected}>
		<div>
			<div class="flex items-end gap-3 pb-2.5">
				<div class="min-w-0 flex-1">
					<div
						class="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.1em] uppercase transition-colors duration-200 {statusColor}"
					>
						<span class="h-1.5 w-1.5 rounded-full transition-colors duration-200 {dotColor}"></span>
						<span class="truncate">{statusLabel}</span>
						{#if voice.status === 'connected' && voice.ping !== null}
							<span class="text-muted">·</span>
							<span class="tabular-nums transition-colors duration-200 {pingColor}">{voice.ping} мс</span>
						{/if}
					</div>
					<div class="mt-1 truncate text-[13px] font-medium text-ink">{shown?.channelName ?? ''}</div>
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
</div>
