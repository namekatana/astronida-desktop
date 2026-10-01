<script lang="ts">
	import { untrack } from 'svelte';
	import { on } from 'svelte/events';
	import { fade } from 'svelte/transition';
	import { albumRows, singleSize } from '$lib/media/album-layout';
	import type { CompressedImage } from '$lib/media/compress';
	import { createPhotoDrafts, type PhotoDraft } from '$lib/media/photo-drafts.svelte';
	import { attachmentMaxCount, messageMaxLength } from '$lib/messages/messages';
	import { pop } from '$lib/ui/pop';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import MenuItem from './MenuItem.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		files: File[];
		caption: string;
		onsend: (text: string, images: CompressedImage[]) => void;
		onclose: (caption: string) => void;
		onclosed: () => void;
	}

	let { files, caption: initialCaption, onsend, onclose, onclosed }: Props = $props();

	const previewWidth = 368;
	const noticeDurationMs = 3000;

	let notice = $state<string | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	// svelte-ignore state_referenced_locally
	let caption = $state(initialCaption);
	let optionsOpen = $state(false);
	let optionsRoot = $state<HTMLDivElement>();
	let textarea = $state<HTMLTextAreaElement>();
	let fileInput = $state<HTMLInputElement>();
	let sendRequested = $state(false);
	let opened = $state(false);
	let closing = $state(false);
	let draggingFiles = $state(false);
	let dragDepth = 0;

	const drafts = createPhotoDrafts(showNotice);
	// svelte-ignore state_referenced_locally
	void drafts.add(files).then(() => (opened = true));

	const tiles = $derived(drafts.list);
	const count = $derived(drafts.list.length);
	const title = $derived(count > 1 ? `Отправить ${count} фото` : 'Отправить фото');
	const subtitle = $derived(
		notice ??
			`${count} из ${attachmentMaxCount}${drafts.highQuality ? ' · высокое качество' : ''}`
	);
	const canSend = $derived(drafts.ready && !sendRequested);
	const shown = $derived(opened && !closing);
	const room = $derived(attachmentMaxCount - count);

	$effect(() => {
		textarea?.focus();
	});

	$effect(() => {
		return () => {
			clearTimeout(noticeTimer);
			drafts.release();
		};
	});

	$effect(() => {
		if (opened && count === 0) untrack(cancel);
	});

	$effect(() => {
		if (!optionsOpen) return;
		const offKey = on(
			window,
			'keydown',
			(event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				event.stopPropagation();
				optionsOpen = false;
			},
			{ capture: true }
		);
		const offPointer = on(document, 'pointerdown', (event) => {
			if (!optionsRoot?.contains(event.target as Node)) optionsOpen = false;
		});
		return () => {
			offKey();
			offPointer();
		};
	});

	function showNotice(text: string) {
		notice = text;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), noticeDurationMs);
	}

	function cancel() {
		if (closing) return;
		closing = true;
		onclose(caption);
	}

	function send() {
		if (!canSend) return;
		sendRequested = true;
		drafts.afterCompression(() => {
			if (closing) return;
			closing = true;
			onsend(caption.trim(), drafts.images());
		});
	}

	function toggleQuality() {
		optionsOpen = false;
		drafts.setHighQuality(!drafts.highQuality);
	}

	function pickMore() {
		optionsOpen = false;
		fileInput?.click();
	}

	function handlePicked() {
		const picked = [...(fileInput?.files ?? [])];
		if (fileInput) fileInput.value = '';
		void drafts.add(picked);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		send();
	}

	function handlePaste(event: ClipboardEvent) {
		if (event.defaultPrevented || closing) return;
		const pasted = [...(event.clipboardData?.files ?? [])];
		if (!pasted.some((file) => file.type.startsWith('image/'))) return;
		event.preventDefault();
		void drafts.add(pasted);
	}

	function carriesFiles(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function handleDragEnter(event: DragEvent) {
		if (event.defaultPrevented || closing || !carriesFiles(event)) return;
		event.preventDefault();
		dragDepth += 1;
		draggingFiles = true;
	}

	function handleDragLeave(event: DragEvent) {
		if (!carriesFiles(event)) return;
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) draggingFiles = false;
	}

	function handleDragOver(event: DragEvent) {
		if (event.defaultPrevented || !carriesFiles(event) || !event.dataTransfer) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function handleDrop(event: DragEvent) {
		if (event.defaultPrevented || !carriesFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		draggingFiles = false;
		if (!closing) void drafts.add([...(event.dataTransfer?.files ?? [])]);
	}
</script>

<svelte:window
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
/>
<svelte:document onpaste={handlePaste} />

<input bind:this={fileInput} type="file" accept="image/*" multiple hidden onchange={handlePicked} />

{#if shown}
	<Dialog label={title} wide flush pinTop onclose={cancel} {onclosed}>
		<SheetHeader
			{title}
			{subtitle}
			subtitleDanger={notice !== null}
			cancelLabel="Отмена"
			oncancel={cancel}
			trailing={options}
		/>

		<div class="relative mx-4">
			{#if draggingFiles}
				<div
					transition:fade={{ duration: 150 }}
					class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-white/25 bg-surface/90 px-6 text-center"
				>
					<Icon name="image" size={24} class="text-ink-secondary" />
					<p class="mt-1 text-[14px] font-semibold text-ink">
						{room > 0 ? 'Отпустите, чтобы добавить' : 'Больше фото не добавить'}
					</p>
					<p class="text-[12px] text-muted">
						{room > 0
							? `Можно ещё ${room} из ${attachmentMaxCount}`
							: `Уже ${attachmentMaxCount} фото`}
					</p>
				</div>
			{/if}
			<div
				class="scrollbar-none max-h-[min(420px,calc(100vh-280px))] overflow-y-auto rounded-[12px]"
			>
				{#if tiles.length === 1}
					{@const size = singleSize(tiles[0], previewWidth)}
					<div class="flex justify-center">
						<div
							class="overflow-hidden rounded-[12px]"
							style="width: {size.width}px; aspect-ratio: {size.width} / {size.height}"
						>
							{@render tile(tiles[0])}
						</div>
					</div>
				{:else}
					<div class="flex flex-col gap-0.5 overflow-hidden rounded-[12px]">
						{#each albumRows(tiles, previewWidth) as row, rowIndex (rowIndex)}
							<div class="flex gap-0.5" style="height: {row.height}px">
								{#each row.tiles as entry (entry.attachment.key)}
									<div class="min-w-0" style="flex: {entry.aspect} 1 0%">
										{@render tile(entry.attachment)}
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="px-4 pt-3 pb-4">
			<div
				class="flex items-end gap-1.5 rounded-[22px] bg-white/[0.05] p-1.5 [corner-shape:round]"
			>
				<textarea
					bind:this={textarea}
					bind:value={caption}
					rows="1"
					maxlength={messageMaxLength}
					placeholder="Добавить подпись…"
					aria-label="Подпись"
					onkeydown={handleKeydown}
					class="scrollbar-none block max-h-[132px] min-h-8 w-full resize-none bg-transparent px-2.5 py-1.5 text-[14px] leading-5 text-ink outline-none [field-sizing:content] placeholder:text-muted"
				></textarea>
				<button
					type="button"
					aria-label="Отправить"
					aria-busy={sendRequested}
					disabled={!canSend}
					onclick={send}
					class="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full duration-200 ease-soft {drafts.ready
						? 'bg-ink text-bg hover:bg-ink-hover active:bg-ink-pressed'
						: 'bg-white/[0.06] text-muted'} {sendRequested ? 'opacity-60' : ''}"
				>
					<Icon name="arrow-up" />
				</button>
			</div>
		</div>
	</Dialog>
{/if}

{#snippet options()}
	<div bind:this={optionsRoot} class="relative -mr-1.5">
		<button
			type="button"
			aria-label="Параметры фото"
			aria-haspopup="menu"
			aria-expanded={optionsOpen}
			onclick={() => (optionsOpen = !optionsOpen)}
			class="pressable flex h-8 w-8 items-center justify-center rounded-full duration-150 {optionsOpen
				? 'bg-white/[0.08] text-ink'
				: 'text-ink-secondary hover:bg-white/[0.06] hover:text-ink'}"
		>
			<Icon name="dots" size={16} />
		</button>
		{#if optionsOpen}
			<div
				role="menu"
				aria-label="Параметры фото"
				in:pop={{ y: -4, duration: 180 }}
				out:fade={{ duration: 100 }}
				class="panel panel-floating absolute top-full right-0 z-10 mt-2 w-[224px] origin-top-right p-1.5"
			>
				<div class="flex flex-col gap-0.5">
					<MenuItem
						icon="hd"
						label="Высокое качество"
						checked={drafts.highQuality}
						onclick={toggleQuality}
					/>
					<MenuItem
						icon="eye-off"
						label="Скрыть под спойлер"
						hint="скоро"
						disabled
						onclick={() => {}}
					/>
				</div>
				<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
				<MenuItem
					icon="plus"
					label="Добавить ещё"
					hint={count >= attachmentMaxCount ? `${attachmentMaxCount} из ${attachmentMaxCount}` : undefined}
					disabled={count >= attachmentMaxCount}
					onclick={pickMore}
				/>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet tile(draft: PhotoDraft)}
	<div class="group relative h-full w-full overflow-hidden bg-white/[0.04]">
		{#if draft.previewUrl}
			<img
				src={draft.previewUrl}
				alt=""
				draggable="false"
				in:fade={{ duration: 150 }}
				class="absolute inset-0 h-full w-full object-cover"
			/>
		{:else}
			<span class="absolute inset-0 animate-pulse bg-white/[0.04]"></span>
		{/if}
		<button
			type="button"
			aria-label="Убрать фото"
			onclick={() => drafts.remove(draft.key)}
			class="pressable absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 duration-150 group-hover:opacity-100 hover:bg-black/75 focus-visible:opacity-100"
		>
			<Icon name="close" size={11} />
		</button>
	</div>
{/snippet}
