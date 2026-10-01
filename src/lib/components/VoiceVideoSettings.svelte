<script lang="ts">
	import { on } from 'svelte/events';
	import {
		defaultDeviceOptions,
		inputModes,
		listDevices,
		maxVolume,
		processingOptions,
		shortcutLabel,
		type AudioProcessingId,
		type VoiceVideoPreferences
	} from '$lib/settings/voice';
	import { reveal } from '$lib/ui/reveal';
	import { settle } from '$lib/ui/settle';
	import CheckCircle from './CheckCircle.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SelectMenu from './SelectMenu.svelte';

	interface Props {
		preferences: VoiceVideoPreferences;
	}

	let { preferences = $bindable() }: Props = $props();

	let devices = $state(defaultDeviceOptions());

	$effect(() => {
		let active = true;
		const refresh = async () => {
			const found = await listDevices();
			if (active) devices = found;
		};
		void refresh();
		const offChange = on(navigator.mediaDevices, 'devicechange', refresh);
		return () => {
			active = false;
			offChange();
		};
	});

	let recordingKey = $state(false);
	let keyButton = $state<HTMLButtonElement>();

	const modifierKeys = new Set(['Control', 'Alt', 'Shift', 'Meta']);

	$effect(() => {
		if (!recordingKey) return;
		let pendingModifier: string | null = null;
		const finish = (label: string | null) => {
			if (label) preferences.pushToTalkKey = label;
			recordingKey = false;
		};
		const offKeyDown = on(
			window,
			'keydown',
			(event) => {
				event.preventDefault();
				event.stopPropagation();
				if (event.repeat) return;
				if (event.key === 'Escape') return finish(null);
				if (modifierKeys.has(event.key)) {
					pendingModifier = shortcutLabel(event);
					return;
				}
				finish(shortcutLabel(event));
			},
			{ capture: true }
		);
		const offKeyUp = on(
			window,
			'keyup',
			(event) => {
				if (pendingModifier && modifierKeys.has(event.key)) finish(pendingModifier);
			},
			{ capture: true }
		);
		const offPointer = on(document, 'pointerdown', (event) => {
			if (!keyButton?.contains(event.target as Node)) finish(null);
		});
		return () => {
			offKeyDown();
			offKeyUp();
			offPointer();
		};
	});

	function toggleProcessing(id: AudioProcessingId) {
		preferences.processing[id] = !preferences.processing[id];
	}
</script>

<section aria-labelledby="voice-microphone">
	<h4 id="voice-microphone" class="px-1 pb-2 text-[13px] font-semibold text-muted">Микрофон</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<SelectMenu label="Устройство" options={devices.audioinput} bind:value={preferences.microphone} />
		{@render divider()}
		{@render volume('Громкость микрофона', preferences.inputVolume, (value) => {
			preferences.inputVolume = value;
		})}
		{@render divider()}
		<div class="px-3 py-2.5">
			<SegmentedControl
				label="Режим ввода"
				options={inputModes}
				bind:value={preferences.inputMode}
			/>
		</div>
		{#if preferences.inputMode === 'pushToTalk'}
			<div transition:reveal>
				{@render divider()}
				<div class="flex h-12 items-center gap-3 px-4">
					<span class="min-w-0 flex-1 truncate text-[13px] text-ink">Клавиша</span>
					<button
						bind:this={keyButton}
						type="button"
						aria-pressed={recordingKey}
						onclick={() => (recordingKey = !recordingKey)}
						class="pressable grid h-8 min-w-[96px] shrink-0 rounded-full px-3.5 text-[12px] font-semibold duration-150 {recordingKey
							? 'bg-white/[0.14] text-ink ring-1 ring-white/25'
							: 'bg-white/[0.08] text-ink hover:bg-white/[0.12]'}"
					>
						{#key recordingKey ? 'recording' : preferences.pushToTalkKey}
							<span
								in:settle
								out:settle={{ duration: 100 }}
								class="col-start-1 row-start-1 self-center whitespace-nowrap tabular-nums"
							>
								{recordingKey ? 'Нажмите клавишу…' : (preferences.pushToTalkKey ?? 'Назначить')}
							</span>
						{/key}
					</button>
				</div>
			</div>
		{/if}
	</div>
	<div class="grid grid-cols-1 px-1 pt-2">
		{#key preferences.inputMode}
			<p
				in:settle
				out:settle={{ duration: 100 }}
				class="col-start-1 row-start-1 text-[12px] leading-4 text-muted"
			>
				{preferences.inputMode === 'voiceActivity'
					? 'Микрофон включается, когда вы говорите'
					: 'Микрофон работает, пока зажата клавиша'}
			</p>
		{/key}
	</div>
</section>

<section aria-labelledby="voice-output" class="mt-6">
	<h4 id="voice-output" class="px-1 pb-2 text-[13px] font-semibold text-muted">Звук</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<SelectMenu label="Устройство" options={devices.audiooutput} bind:value={preferences.speaker} />
		{@render divider()}
		{@render volume('Громкость звука', preferences.outputVolume, (value) => {
			preferences.outputVolume = value;
		})}
	</div>
</section>

<section aria-labelledby="voice-processing" class="mt-6">
	<h4 id="voice-processing" class="px-1 pb-2 text-[13px] font-semibold text-muted">Обработка</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		{#each processingOptions as option, index (option.id)}
			{@const checked = preferences.processing[option.id]}
			{#if index > 0}
				{@render divider()}
			{/if}
			<button
				type="button"
				role="checkbox"
				aria-checked={checked}
				onclick={() => toggleProcessing(option.id)}
				class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.03]"
			>
				<span class="min-w-0 flex-1">
					<span
						class="block truncate text-[14px] leading-5 transition-colors duration-150 {checked
							? 'text-ink'
							: 'text-ink-secondary'}"
					>
						{option.label}
					</span>
					<span class="mt-0.5 block truncate text-[12px] leading-4 text-muted">
						{option.description}
					</span>
				</span>
				<CheckCircle {checked} />
			</button>
		{/each}
	</div>
</section>

<section aria-labelledby="voice-video" class="mt-6">
	<h4 id="voice-video" class="px-1 pb-2 text-[13px] font-semibold text-muted">Видео</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<SelectMenu label="Камера" options={devices.videoinput} bind:value={preferences.camera} />
		{@render divider()}
		<div class="flex h-12 items-center gap-3 px-4">
			<span class="min-w-0 flex-1 truncate text-[13px] text-ink">Проверка камеры</span>
			<button
				type="button"
				class="pressable h-8 shrink-0 rounded-full bg-white/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12]"
			>
				Проверить
			</button>
		</div>
	</div>
</section>

{#snippet volume(label: string, value: number, onchange: (value: number) => void)}
	<div class="flex h-12 items-center gap-3 px-4">
		<span class="w-24 shrink-0 truncate text-[13px] text-ink">Громкость</span>
		<input
			type="range"
			min="0"
			max={maxVolume}
			step="5"
			{value}
			aria-label={label}
			oninput={(event) => onchange(event.currentTarget.valueAsNumber)}
			class="range block min-w-0 flex-1"
			style="--range-fill: {(value / maxVolume) * 100}%"
		/>
		<span class="w-11 shrink-0 text-right text-[13px] text-ink-secondary tabular-nums">
			{value}%
		</span>
	</div>
{/snippet}

{#snippet divider()}
	<div class="ml-4 h-px bg-white/[0.06]"></div>
{/snippet}
