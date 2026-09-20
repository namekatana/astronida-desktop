<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { qualityColorClass } from '$lib/voice/quality';
	import type { VoiceQuality } from '$lib/voice/transport';
	import { voice } from '$lib/voice/voice.svelte';
	import Icon from './Icon.svelte';
	import SignalBars from './SignalBars.svelte';

	interface Props {
		anchor: HTMLElement | null;
		onclose: () => void;
	}

	let { anchor, onclose }: Props = $props();

	let root = $state<HTMLDivElement | null>(null);

	const width = 320;
	const margin = 8;
	const gap = 10;

	let anchorRect = $state<DOMRect | null>(null);
	const left = $derived(
		anchorRect ? Math.max(margin, Math.min(anchorRect.right - width, window.innerWidth - width - margin)) : margin
	);
	const bottom = $derived(anchorRect ? window.innerHeight - anchorRect.top + gap : margin);

	$effect(() => {
		const update = () => (anchorRect = anchor?.getBoundingClientRect() ?? null);
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	});

	const qualityLabels: Record<VoiceQuality, string> = {
		excellent: 'Отличное',
		good: 'Хорошее',
		poor: 'Слабое',
		lost: 'Связь потеряна'
	};

	const rtt = $derived(
		voice.stats?.rttMs === null || voice.stats?.rttMs === undefined
			? null
			: Math.max(1, voice.stats.rttMs)
	);
	const loss = $derived(voice.stats?.lossPercent ?? null);
	const groups = $derived(voice.keyFingerprint?.split(' ') ?? []);

	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	async function copyCode() {
		const code = voice.keyFingerprint;
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code);
		} catch {
			return;
		}
		copied = true;
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), 1500);
	}

	$effect(() => {
		if (!root) return;
		return dismissOn(root, (target) => {
			if (target && anchor?.contains(target)) return;
			onclose();
		});
	});
</script>

<div
	bind:this={root}
	role="dialog"
	aria-label="Соединение"
	in:fly={{ y: 6, duration: 220, easing: (t) => 1 - Math.pow(1 - t, 3) }}
	out:fade={{ duration: 120 }}
	style="left: {left}px; bottom: {bottom}px; width: {width}px"
	class="panel fixed z-50 px-4 pt-3.5 pb-4"
>
	<div class="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">Соединение</div>
	<div class="mt-2 grid grid-cols-3 gap-2">
		<div class="rounded-md bg-surface-raised px-2.5 py-2">
			<div class="text-[10px] text-muted">Пинг</div>
			<div class="mt-0.5 text-[13px] font-medium text-ink tabular-nums">
				{rtt === null ? '—' : `${rtt} мс`}
			</div>
		</div>
		<div class="rounded-md bg-surface-raised px-2.5 py-2">
			<div class="text-[10px] text-muted">Потери</div>
			<div class="mt-0.5 text-[13px] font-medium text-ink tabular-nums">
				{loss === null ? '—' : `${loss}%`}
			</div>
		</div>
		<div class="rounded-md bg-surface-raised px-2.5 py-2">
			<div class="text-[10px] text-muted">Качество</div>
			<div
				class="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium {voice.quality
					? qualityColorClass(voice.quality)
					: 'text-muted'}"
			>
				{#if voice.quality}
					<SignalBars quality={voice.quality} />
					<span class="truncate">{qualityLabels[voice.quality]}</span>
				{:else}
					—
				{/if}
			</div>
		</div>
	</div>

	<div class="mt-4 flex items-baseline justify-between gap-2">
		<div class="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.1em] text-muted uppercase">
			<Icon name="lock" size={11} />
			Сквозное шифрование
		</div>
		{#if voice.encrypted}
			<div class="shrink-0 text-[11px] text-muted tabular-nums">ключ №{voice.keyVersion}</div>
		{/if}
	</div>
	{#if voice.encrypted && groups.length > 0}
		<div class="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
			{#each groups as group, index (index)}
				<div
					class="rounded-md bg-surface-raised py-1.5 text-center font-mono text-[13px] tracking-[0.08em] text-ink tabular-nums"
				>
					{group}
				</div>
			{/each}
		</div>
		<button
			type="button"
			onclick={copyCode}
			class="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] transition-colors duration-150 {copied
				? 'bg-online/10 text-online'
				: 'bg-white/[0.04] text-ink-secondary hover:bg-white/[0.08] hover:text-ink'}"
		>
			<Icon name={copied ? 'check' : 'copy'} size={13} />
			{copied ? 'Скопировано' : 'Копировать код'}
		</button>
		<p class="mt-2.5 text-[12px] leading-relaxed text-muted">
			Назовите код друг другу. Если он совпадает у всех в канале, разговор зашифрован одним
			ключом и медиасервер его не видит. Код меняется, когда кто-то выходит из канала.
		</p>
	{:else}
		<p class="mt-2 text-[12px] leading-relaxed text-danger">Шифрование не установлено.</p>
	{/if}
</div>
