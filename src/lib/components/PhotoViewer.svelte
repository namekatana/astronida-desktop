<script lang="ts">
	import { cubicOut, quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { cachedImage, isStoredLocally, loadImage } from '$lib/media/images';
	import {
		copyPhoto,
		photoFileName,
		photoFileSize,
		revealSavedPhoto,
		savePhoto
	} from '$lib/media/photo-actions';
	import { thumbHashImage } from '$lib/media/thumbhash-image';
	import { panBy, unzoomed, zoomAt, type Point, type Zoom } from '$lib/media/zoom';
	import type { Message } from '$lib/messages/messages';
	import type { IconName } from '$lib/ui/icons';
	import { pop } from '$lib/ui/pop';
	import DrawnCheck from './DrawnCheck.svelte';
	import Icon from './Icon.svelte';
	import MenuItem from './MenuItem.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		message: Message;
		index: number;
		origin: DOMRect | null;
		onnavigate: (index: number) => void;
		onforward: (message: Message) => void;
		onclose: () => void;
	}

	let { message, index, origin, onnavigate, onforward, onclose }: Props = $props();

	type Notice = {
		text: string;
		failed: boolean;
		revealPath: string | null;
		version: number;
	};

	const noticeVisibleMs = 2400;
	const noticeWithActionMs = 4500;
	const longDate = new Intl.DateTimeFormat('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	const standardMaxSide = 1280;

	let optionsOpen = $state(false);
	let detailsOpen = $state(false);
	let fileSize = $state<number | null>(null);
	let saving = $state(false);
	let notice = $state<Notice | null>(null);
	let noticeVersion = 0;
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	const attachments = $derived(message.attachments ?? []);
	const details = $derived.by((): [string, string][] => {
		const rows: [string, string][] = [['Отправитель', `@${message.author.username}`]];
		if (message.forwardedFrom) rows.push(['Переслано от', `@${message.forwardedFrom.username}`]);
		rows.push(
			['Дата', longDate.format(message.sentAt)],
			['Размер', `${attachment.width} × ${attachment.height}`],
			['Вес', fileSize === null ? '…' : formatBytes(fileSize)],
			['Формат', 'WebP'],
			[
				'Качество',
				Math.max(attachment.width, attachment.height) > standardMaxSide ? 'HD' : 'Стандарт'
			]
		);
		return rows;
	});

	const sideGutter = 88;
	const verticalGutter = 72;
	const blurDelayMs = 150;
	const revealMs = 220;

	let viewportWidth = $state(window.innerWidth);
	let viewportHeight = $state(window.innerHeight);
	let dialog = $state<HTMLDivElement>();
	let fullUrl = $state<string | null>(null);
	let feedUrl = $state<string | null>(null);
	let blurShown = $state(false);
	let zoom = $state<Zoom>(unzoomed);
	let panning = $state(false);
	let pan: { pointerId: number; x: number; y: number; travelled: number } | null = null;
	let suppressClose = false;

	const wheelSensitivity = 0.0015;
	const pinchSensitivity = 0.01;
	const wheelLinePx = 16;
	const doubleClickZoom = 2.5;
	const dragThresholdPx = 4;

	const attachment = $derived(attachments[index]);
	const placeholder = $derived(blurShown ? thumbHashImage(attachment.thumbHash) : null);
	const frame = $derived.by(() => {
		const scale = Math.min(
			1,
			(viewportWidth - sideGutter * 2) / attachment.width,
			(viewportHeight - verticalGutter * 2) / attachment.height
		);
		return {
			width: Math.max(1, Math.round(attachment.width * scale)),
			height: Math.max(1, Math.round(attachment.height * scale))
		};
	});
	const hasAlbum = $derived(attachments.length > 1);

	$effect.pre(() => {
		const current = attachment;
		let active = true;
		let fullReady = false;
		const instantFull = cachedImage(current, 'full');
		const instantFeed = instantFull ? null : (current.localUrl ?? cachedImage(current, 'feed'));
		const nothingInstant = !instantFull && !instantFeed;
		blurShown =
			nothingInstant &&
			!isStoredLocally(current, 'feed') &&
			!isStoredLocally(current, 'full');
		fullUrl = instantFull;
		feedUrl = instantFeed;
		const blurTimer = nothingInstant
			? setTimeout(() => (blurShown = true), blurDelayMs)
			: undefined;
		if (!instantFull && !instantFeed) {
			void loadImage(current, 'feed').then((url) => {
				if (!active || !url || fullReady) return;
				clearTimeout(blurTimer);
				feedUrl = url;
			});
		}
		if (!instantFull) {
			void loadImage(current, 'full').then((url) => {
				if (!active || !url) return;
				fullReady = true;
				clearTimeout(blurTimer);
				fullUrl = url;
			});
		}
		return () => {
			active = false;
			clearTimeout(blurTimer);
		};
	});

	$effect(() => {
		if (!hasAlbum) return;
		const count = attachments.length;
		for (const offset of [1, -1]) {
			void loadImage(attachments[(index + offset + count) % count], 'full');
		}
	});

	$effect(() => {
		dialog?.focus();
	});

	const viewport = $derived({ width: viewportWidth, height: viewportHeight });
	const zoomed = $derived(zoom.scale > 1);

	$effect(() => {
		void index;
		void viewportWidth;
		void viewportHeight;
		zoom = unzoomed;
	});

	$effect(() => {
		const node = dialog;
		if (!node) return;
		node.addEventListener('wheel', handleWheel, { passive: false });
		return () => node.removeEventListener('wheel', handleWheel);
	});

	function pointFrom(event: MouseEvent): Point {
		return { x: event.clientX - viewportWidth / 2, y: event.clientY - viewportHeight / 2 };
	}

	function handleWheel(event: WheelEvent) {
		if ((event.target as Element).closest('[data-viewer-popover]')) return;
		event.preventDefault();
		const pixels = event.deltaMode === 1 ? event.deltaY * wheelLinePx : event.deltaY;
		const sensitivity = event.ctrlKey ? pinchSensitivity : wheelSensitivity;
		const scale = zoom.scale * Math.exp(-pixels * sensitivity);
		zoom = zoomAt(zoom, scale, pointFrom(event), frame, viewport);
	}

	function toggleZoom(event: MouseEvent) {
		if ((event.target as Element).closest('[data-viewer-control]')) return;
		zoom = zoomed ? unzoomed : zoomAt(zoom, doubleClickZoom, pointFrom(event), frame, viewport);
	}

	function startPan(event: PointerEvent) {
		suppressClose = false;
		const target = event.target as Element;
		if ((optionsOpen || detailsOpen) && !target.closest('[data-viewer-popover]')) {
			optionsOpen = false;
			detailsOpen = false;
			suppressClose = true;
			return;
		}
		if (!zoomed || event.button !== 0) return;
		if ((event.target as Element).closest('[data-viewer-control]')) return;
		pan = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, travelled: 0 };
		dialog?.setPointerCapture(event.pointerId);
		panning = true;
	}

	function movePan(event: PointerEvent) {
		if (!pan || event.pointerId !== pan.pointerId) return;
		const shift = { x: event.clientX - pan.x, y: event.clientY - pan.y };
		const travelled = pan.travelled + Math.hypot(shift.x, shift.y);
		pan = { ...pan, x: event.clientX, y: event.clientY, travelled };
		zoom = panBy(zoom, shift, frame, viewport);
	}

	function endPan(event: PointerEvent) {
		if (!pan || event.pointerId !== pan.pointerId) return;
		suppressClose = pan.travelled > dragThresholdPx;
		pan = null;
		panning = false;
	}

	function closeFromBackdrop() {
		if (suppressClose) {
			suppressClose = false;
			return;
		}
		onclose();
	}

	$effect(() => {
		const current = attachment;
		if (!detailsOpen) return;
		let active = true;
		fileSize = null;
		void photoFileSize(current).then((size) => {
			if (active) fileSize = size;
		});
		return () => {
			active = false;
		};
	});

	$effect(() => () => clearTimeout(noticeTimer));

	function showNotice(text: string, options: { failed?: boolean; revealPath?: string | null } = {}) {
		clearTimeout(noticeTimer);
		noticeVersion += 1;
		notice = {
			text,
			failed: options.failed ?? false,
			revealPath: options.revealPath ?? null,
			version: noticeVersion
		};
		const visibleMs = notice.revealPath ? noticeWithActionMs : noticeVisibleMs;
		noticeTimer = setTimeout(() => (notice = null), visibleMs);
	}

	async function download() {
		if (saving) return;
		saving = true;
		const name = photoFileName(message.sentAt, index, attachments.length);
		const result = await savePhoto(attachment, name);
		saving = false;
		if (result.ok) showNotice('Фото сохранено в «Загрузки»', { revealPath: result.path });
		else showNotice('Не удалось сохранить фото', { failed: true });
	}

	async function copy() {
		optionsOpen = false;
		const copied = await copyPhoto(attachment);
		if (copied) showNotice('Фото скопировано');
		else showNotice('Не удалось скопировать фото', { failed: true });
	}

	function openDetails() {
		optionsOpen = false;
		detailsOpen = true;
	}

	function toggleOptions() {
		if (detailsOpen) detailsOpen = false;
		else optionsOpen = !optionsOpen;
	}

	function reveal(path: string) {
		void revealSavedPhoto(path).catch(() => {});
		notice = null;
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
		return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
	}

	function step(direction: -1 | 1) {
		if (!hasAlbum) return;
		onnavigate((index + direction + attachments.length) % attachments.length);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			if (optionsOpen) optionsOpen = false;
			else if (detailsOpen) detailsOpen = false;
			else onclose();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			step(-1);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			step(1);
		}
	}

	$effect(() => {
		document.addEventListener('keydown', handleKeydown, true);
		return () => document.removeEventListener('keydown', handleKeydown, true);
	});

	function growFrom(node: HTMLElement, from: DOMRect | null): TransitionConfig {
		if (!from) return { duration: 0 };
		if (prefersReducedMotion.current) return { duration: 150, css: (t) => `opacity: ${t}` };
		const target = node.getBoundingClientRect();
		const scale = Math.min(from.width / target.width, from.height / target.height);
		const shiftX = from.left + from.width / 2 - (target.left + target.width / 2);
		const shiftY = from.top + from.height / 2 - (target.top + target.height / 2);
		return {
			duration: 320,
			easing: quintOut,
			css: (t, u) =>
				`transform: translate(${shiftX * u}px, ${shiftY * u}px) scale(${scale + (1 - scale) * t})`
		};
	}

	function visibleTileOf(attachmentId: string): DOMRect | null {
		const tile = document.querySelector(`[data-attachment-id="${CSS.escape(attachmentId)}"]`);
		if (!tile) return null;
		const rect = tile.getBoundingClientRect();
		const onScreen =
			rect.width > 0 &&
			rect.bottom > 0 &&
			rect.top < window.innerHeight &&
			rect.right > 0 &&
			rect.left < window.innerWidth;
		return onScreen ? rect : null;
	}

	function shrinkHome(node: HTMLElement): TransitionConfig {
		if (prefersReducedMotion.current) return { duration: 120, css: (t) => `opacity: ${t}` };
		const home = zoomed ? null : visibleTileOf(attachment.id);
		if (!home) {
			return {
				duration: 180,
				easing: cubicOut,
				css: (t) => `opacity: ${t}; transform: scale(${0.94 + 0.06 * t})`
			};
		}
		const from = node.getBoundingClientRect();
		const scale = Math.max(home.width / from.width, home.height / from.height);
		const shiftX = home.left + home.width / 2 - (from.left + from.width / 2);
		const shiftY = home.top + home.height / 2 - (from.top + from.height / 2);
		return {
			duration: 280,
			easing: cubicOut,
			css: (t, u) =>
				`transform: translate(${shiftX * u}px, ${shiftY * u}px) scale(${1 + (scale - 1) * u}); opacity: ${Math.min(1, t * 3)}`
		};
	}
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

<div
	bind:this={dialog}
	role="dialog"
	aria-modal="true"
	aria-label="Просмотр фото"
	tabindex="-1"
	onpointerdown={startPan}
	onpointermove={movePan}
	onpointerup={endPan}
	onpointercancel={endPan}
	ondblclick={toggleZoom}
	class="fixed inset-0 z-[60] flex items-center justify-center outline-none select-none {panning
		? 'cursor-grabbing'
		: ''}"
>
	<button
		type="button"
		aria-label="Закрыть просмотр"
		tabindex="-1"
		onclick={closeFromBackdrop}
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 240, easing: cubicOut }}
		class="absolute inset-0 bg-black/90 {zoomed ? 'cursor-grab' : 'cursor-default'}"
	></button>

	<div out:shrinkHome class="relative">
		<div
			class="relative {zoomed && !panning ? 'cursor-grab' : ''}"
			style="transform: translate({zoom.x}px, {zoom.y}px) scale({zoom.scale}); transition: {panning
				? 'none'
				: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)'}"
		>
			{#key index}
				<div
					in:growFrom|global={origin}
					class="relative overflow-hidden rounded-[6px]"
					style="width: {frame.width}px; height: {frame.height}px"
				>
					{#if placeholder}
						<img
							src={placeholder}
							alt=""
							aria-hidden="true"
							draggable="false"
							class="absolute inset-0 h-full w-full"
						/>
					{/if}
					{#if feedUrl}
						<img
							src={feedUrl}
							alt=""
							draggable="false"
							decoding="sync"
							in:fade={{ duration: blurShown ? revealMs : 0, easing: cubicOut }}
							class="absolute inset-0 h-full w-full"
						/>
					{/if}
					{#if fullUrl}
						<img
							src={fullUrl}
							alt=""
							draggable="false"
							decoding="sync"
							in:fade={{ duration: blurShown || feedUrl ? revealMs : 0, easing: cubicOut }}
							class="absolute inset-0 h-full w-full"
						/>
					{/if}
				</div>
			{/key}
		</div>
	</div>

	<div
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 120 }}
		class="pointer-events-none absolute inset-x-0 top-0 flex h-16 items-center justify-center px-4"
	>
		{#if hasAlbum}
			<span class="text-[13px] font-semibold text-ink-secondary tabular-nums">
				{index + 1} из {attachments.length}
			</span>
		{/if}
		<div data-viewer-control class="pointer-events-auto absolute top-4 right-4 flex gap-2">
			{@render toolbarButton('forward', 'Переслать', () => onforward(message))}
			{@render toolbarButton('download', 'Скачать', () => void download(), saving)}
			<div data-viewer-popover class="relative">
				{@render toolbarButton('dots', 'Ещё', toggleOptions, false, optionsOpen || detailsOpen)}
				{#if optionsOpen}
					<div
						role="menu"
						aria-label="Действия с фото"
						in:pop={{ y: -4, duration: 180 }}
						out:fade|global={{ duration: 100 }}
						class="panel panel-floating absolute top-full right-0 z-10 mt-2 w-[200px] origin-top-right p-1.5"
					>
						<div class="flex flex-col gap-0.5">
							<MenuItem icon="info" label="Подробности" onclick={openDetails} />
							<MenuItem icon="copy" label="Скопировать фото" onclick={() => void copy()} />
						</div>
					</div>
				{/if}
			</div>
			{@render toolbarButton('close', 'Закрыть', onclose)}
		</div>
	</div>

	{#if detailsOpen}
		<div
			data-viewer-control
			data-viewer-popover
			role="dialog"
			aria-label="Подробности"
			in:pop={{ y: -4, duration: 180 }}
			out:fade|global={{ duration: 100 }}
			class="panel panel-floating absolute top-16 right-4 z-10 w-[300px] origin-top-right pb-4"
		>
			<SheetHeader
				title="Подробности"
				subtitle={hasAlbum ? `Фото ${index + 1} из ${attachments.length}` : undefined}
			/>
			<div class="mx-4 overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
				{#each details as [label, value], rowIndex (label)}
					{#if rowIndex > 0}
						<div class="mx-4 h-px bg-surface-line"></div>
					{/if}
					<div class="flex h-10 items-center gap-3 px-4">
						<span class="min-w-0 flex-1 truncate text-[13px] text-ink">{label}</span>
						<span class="shrink-0 text-[13px] text-ink-secondary tabular-nums">{value}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div
		aria-live="polite"
		class="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center px-4"
	>
		{#if notice}
			{#key notice.version}
				<div
					in:pop={{ y: 8, duration: 220 }}
					out:fade|global={{ duration: 140 }}
					class="flex h-9 items-center gap-2 rounded-full bg-[#2c2c2e] pl-3.5 text-[13px] font-medium whitespace-nowrap text-ink {notice.revealPath
						? 'pr-1.5'
						: 'pr-3.5'}"
				>
					{#if notice.failed}
						<Icon name="close" size={13} class="shrink-0 text-danger" />
					{:else}
						<DrawnCheck size={14} delay={100} class="shrink-0" />
					{/if}
					{notice.text}
					{#if notice.revealPath}
						{@const path = notice.revealPath}
						<button
							type="button"
							data-viewer-control
							onclick={() => reveal(path)}
							class="pressable pointer-events-auto h-7 rounded-full bg-white/[0.08] px-3 text-[12px] font-semibold text-ink hover:bg-white/[0.14]"
						>
							Показать
						</button>
					{/if}
				</div>
			{/key}
		{/if}
	</div>

	{#if hasAlbum}
		<button
			type="button"
			aria-label="Предыдущее фото"
			data-viewer-control
			onclick={() => step(-1)}
			in:fade|global={{ duration: 200 }}
			out:fade|global={{ duration: 120 }}
			class="pressable absolute top-1/2 left-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-ink hover:bg-white/[0.14]"
		>
			<Icon name="chevron" size={16} class="rotate-90" />
		</button>
		<button
			type="button"
			aria-label="Следующее фото"
			data-viewer-control
			onclick={() => step(1)}
			in:fade|global={{ duration: 200 }}
			out:fade|global={{ duration: 120 }}
			class="pressable absolute top-1/2 right-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.08] text-ink hover:bg-white/[0.14]"
		>
			<Icon name="chevron" size={16} class="-rotate-90" />
		</button>
	{/if}
</div>

{#snippet toolbarButton(
	icon: IconName,
	label: string,
	onclick: () => void,
	disabled = false,
	active = false
)}
	<button
		type="button"
		aria-label={label}
		title={label}
		{disabled}
		{onclick}
		class="pressable flex h-10 w-10 items-center justify-center rounded-full text-ink disabled:opacity-50 {active
			? 'bg-white/[0.16]'
			: 'bg-white/[0.08] hover:bg-white/[0.14]'}"
	>
		<Icon name={icon} size={16} />
	</button>
{/snippet}
