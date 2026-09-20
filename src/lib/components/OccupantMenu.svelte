<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import type { IconName } from '$lib/ui/icons';
	import { initials } from '$lib/ui/initials';
	import type { VoiceOccupant } from '$lib/voice/occupant';
	import { voice } from '$lib/voice/voice.svelte';
	import { defaultVolume, maxVolume, participantAudio } from '$lib/voice/volumes.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		occupant: VoiceOccupant;
		x: number;
		y: number;
		onclose: () => void;
		onprofile?: (occupant: VoiceOccupant) => void;
	}

	let { occupant, x, y, onclose, onprofile }: Props = $props();

	const width = 224;
	const margin = 8;

	let root = $state<HTMLDivElement | null>(null);
	let height = $state(0);

	const left = $derived(Math.max(margin, Math.min(x, window.innerWidth - width - margin)));
	const top = $derived(Math.max(margin, Math.min(y, window.innerHeight - height - margin)));

	const muted = $derived(participantAudio.muted(occupant.id));
	const percent = $derived(Math.round(participantAudio.volume(occupant.id) * 100));

	function handleVolume(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		voice.setParticipantVolume(occupant.id, value / 100);
	}

	function resetVolume() {
		voice.setParticipantVolume(occupant.id, defaultVolume);
	}

	function toggleMuted() {
		voice.setParticipantMuted(occupant.id, !muted);
	}

	function openProfile() {
		onprofile?.(occupant);
		onclose();
	}

	$effect(() => {
		if (!root) return;
		height = root.offsetHeight;
		return dismissOn(root, onclose);
	});
</script>

{#snippet item(icon: IconName, label: string, onclick: () => void, active = false)}
	<button
		type="button"
		role="menuitem"
		{onclick}
		class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-white/[0.06] {active
			? 'text-ink'
			: 'text-ink-secondary hover:text-ink'}"
	>
		<Icon name={icon} size={15} class={active ? 'text-ink' : 'text-muted'} />
		<span class="min-w-0 flex-1 truncate">{label}</span>
		{#if active}
			<Icon name="check" size={14} class="text-ink" />
		{/if}
	</button>
{/snippet}

<div
	bind:this={root}
	role="menu"
	aria-label="Участник @{occupant.username}"
	in:fly={{ y: -4, duration: 180, easing: (t) => 1 - Math.pow(1 - t, 3) }}
	out:fade={{ duration: 100 }}
	style="left: {left}px; top: {top}px; width: {width}px"
	class="panel fixed z-50 p-1.5"
>
	<div class="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
		<span
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
		>
			{initials(occupant.name)}
		</span>
		<div class="min-w-0">
			<div class="truncate text-[13px] font-medium text-ink">{occupant.name}</div>
			<div class="truncate text-[11px] text-muted">@{occupant.username}</div>
		</div>
	</div>
	<div class="mx-1.5 h-px bg-surface-line"></div>

	<div class="mt-1.5 flex flex-col gap-0.5">
		{@render item('user', 'Профиль', openProfile)}
		{@render item('volume-off', muted ? 'Заглушён' : 'Заглушить', toggleMuted, muted)}
	</div>

	<div class="mx-1.5 mt-1.5 h-px bg-surface-line"></div>

	<div class="px-2.5 pt-2 pb-1.5 {muted ? 'opacity-40' : ''}">
		<div class="flex items-baseline justify-between text-[11px] text-muted">
			<span class="font-medium tracking-[0.1em] uppercase">Громкость</span>
			<button
				type="button"
				onclick={resetVolume}
				disabled={muted || percent === defaultVolume * 100}
				class="tabular-nums transition-colors duration-150 hover:text-ink disabled:pointer-events-none"
				title="Сбросить до 100%"
			>
				{percent}%
			</button>
		</div>
		<input
			type="range"
			min="0"
			max={maxVolume * 100}
			step="5"
			value={percent}
			disabled={muted}
			aria-label="Громкость"
			oninput={handleVolume}
			ondblclick={resetVolume}
			class="range mt-2 block w-full disabled:pointer-events-none"
			style="--range-fill: {percent / maxVolume}%"
		/>
	</div>
</div>
