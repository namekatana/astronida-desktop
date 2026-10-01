<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import { qualityColorClass } from '$lib/voice/quality';
	import type { VoiceQuality } from '$lib/voice/transport';
	import { voice } from '$lib/voice/voice.svelte';
	import Icon from './Icon.svelte';
	import SheetHeader from './SheetHeader.svelte';
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
	in:pop={{ y: 4, duration: 180 }}
	out:fade={{ duration: 100 }}
	style="left: {left}px; bottom: {bottom}px; width: {width}px"
	class="panel panel-floating fixed z-50 origin-bottom-right pb-4"
>
	<SheetHeader
		title="Соединение"
		subtitle={voice.quality ? qualityLabels[voice.quality] : 'Нет данных'}
	/>

	<div class="px-4">
		<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
			{@render row('Пинг', rtt === null ? '—' : `${rtt} мс`)}
			<div class="mx-4 h-px bg-surface-line"></div>
			{@render row('Потери', loss === null ? '—' : `${loss}%`)}
			<div class="mx-4 h-px bg-surface-line"></div>
			<div class="flex h-11 items-center gap-3 px-4">
				<span class="min-w-0 flex-1 truncate text-[13px] text-ink">Качество</span>
				<span
					class="flex shrink-0 items-center gap-1.5 text-[13px] {voice.quality
						? qualityColorClass(voice.quality)
						: 'text-ink-secondary'}"
				>
					{#if voice.quality}
						<SignalBars quality={voice.quality} />
						{qualityLabels[voice.quality]}
					{:else}
						—
					{/if}
				</span>
			</div>
		</div>

		<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-1.5 text-[12px] text-muted">
			<span class="flex items-center gap-1.5">
				<Icon name="lock" size={11} />
				Сквозное шифрование
			</span>
			{#if voice.encrypted}
				<span class="shrink-0 tabular-nums">ключ №{voice.keyVersion}</span>
			{/if}
		</div>

		{#if voice.encrypted && groups.length > 0}
			<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
				<div class="grid grid-cols-3 gap-x-2 gap-y-2 px-4 py-3.5">
					{#each groups as group, index (index)}
						<span
							class="text-center font-mono text-[14px] tracking-[0.08em] text-ink tabular-nums"
						>
							{group}
						</span>
					{/each}
				</div>
				<div class="mx-4 h-px bg-surface-line"></div>
				<button
					type="button"
					onclick={copyCode}
					class="flex h-11 w-full items-center gap-2.5 px-4 text-left text-[13px] transition-colors duration-150 hover:bg-white/[0.03] {copied
						? 'text-online'
						: 'text-ink'}"
				>
					<Icon name={copied ? 'check' : 'copy'} size={14} class={copied ? '' : 'text-muted'} />
					{copied ? 'Скопировано' : 'Скопировать код'}
				</button>
			</div>
			<p class="px-4 pt-2 text-[12px] leading-[18px] text-muted">
				Назовите код друг другу. Если он совпадает у всех в канале, разговор зашифрован одним
				ключом и медиасервер его не видит. Код меняется, когда кто-то выходит из канала.
			</p>
		{:else}
			<div class="rounded-[14px] bg-white/[0.05] px-4 py-3 [corner-shape:squircle]">
				<p class="text-[13px] leading-5 text-danger">Шифрование не установлено</p>
			</div>
		{/if}
	</div>
</div>

{#snippet row(label: string, value: string)}
	<div class="flex h-11 items-center gap-3 px-4">
		<span class="min-w-0 flex-1 truncate text-[13px] text-ink">{label}</span>
		<span class="shrink-0 text-[13px] text-ink-secondary tabular-nums">{value}</span>
	</div>
{/snippet}
