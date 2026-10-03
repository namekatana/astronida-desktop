<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut, quartOut, quintOut } from 'svelte/easing';
	import { on } from 'svelte/events';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { renderAvatar, type AvatarImages } from '$lib/media/avatar-image';
	import { renderBanner } from '$lib/media/banner-image';
	import { bannerSize } from '$lib/media/banner-size';
	import { removeAvatar, uploadAvatar } from '$lib/profile/avatar';
	import { removeBanner, uploadBanner } from '$lib/profile/banner';
	import { limitBioLines, normalizeBio, saveBio } from '$lib/profile/bio';
	import {
		createImageEditor,
		type CropFrame,
		type ImageEditor
	} from '$lib/profile/image-editor.svelte';
	import type { AvatarPreview, ProfileCard, ProfileEditing } from '$lib/profile/profile';
	import { materialize } from '$lib/ui/materialize';
	import { pop } from '$lib/ui/pop';
	import { settle } from '$lib/ui/settle';
	import DrawnCheck from './DrawnCheck.svelte';
	import Icon from './Icon.svelte';
	import ImageCropper from './ImageCropper.svelte';
	import MenuItem from './MenuItem.svelte';
	import Orbit from './Orbit.svelte';
	import ProfileContent from './ProfileContent.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		card: ProfileCard;
		source: HTMLElement | null;
		onclose: () => void;
		onavatarchange: (avatarId: string | null) => void;
		onbannerchange: (bannerId: string | null) => void;
		onbiochange: (bio: string | null) => void;
	}

	let { card, source, onclose, onavatarchange, onbannerchange, onbiochange }: Props = $props();

	type PhotoKind = 'avatar' | 'banner';

	const origin = untrack(() => source);

	const growMs = 420;
	const returnMs = 320;
	const cometDelayMs = 300;
	const savedPauseMs = 900;
	const editingHint = 'Нажмите на фото или баннер, чтобы изменить';
	const quintOutCurve = 'cubic-bezier(0.22, 1, 0.36, 1)';
	const quartOutCurve = 'cubic-bezier(0.25, 1, 0.5, 1)';

	let dialog = $state<HTMLDivElement | null>(null);
	let content = $state<ReturnType<typeof ProfileContent>>();
	let cropper = $state<ReturnType<typeof ImageCropper>>();
	let fileInput = $state<HTMLInputElement | null>(null);
	let photoMenu = $state<{ kind: PhotoKind; left: number; top: number } | null>(null);
	let pickingFor: PhotoKind = 'avatar';
	let cropTarget = $state<PhotoKind>('avatar');
	let cropExit = $state<'apply' | 'cancel'>('apply');
	let menuElement = $state<HTMLDivElement | null>(null);
	let editing = $state(false);
	let saved = $state(false);
	let bioDraft = $state('');
	let bioSaving = $state(false);
	let bioError = $state<string | null>(null);
	let savedTimer: ReturnType<typeof setTimeout> | null = null;

	const menuWidth = 200;
	const frames: Record<PhotoKind, CropFrame> = {
		avatar: { width: 280, height: 280, radius: 140, rotatable: true },
		banner: {
			width: 368,
			height: 92,
			radius: 10,
			rotatable: false,
			minimum: { width: bannerSize.width, notice: 'Фото маловато — будет нечётким' }
		}
	};
	const targetSelectors: Record<PhotoKind, string> = {
		avatar: '[data-avatar-face]',
		banner: '[data-banner]'
	};

	const avatarEditor = createImageEditor<AvatarImages>({
		render: renderAvatar,
		previewOf: (images) => images.large,
		upload: uploadAvatar,
		remove: removeAvatar
	});
	const bannerEditor = createImageEditor<Blob>({
		render: renderBanner,
		previewOf: (image) => image,
		upload: uploadBanner,
		remove: removeBanner
	});

	function editorOf(kind: PhotoKind): ImageEditor<AvatarImages> | ImageEditor<Blob> {
		return kind === 'avatar' ? avatarEditor : bannerEditor;
	}

	const cropping = $derived<PhotoKind | null>(
		avatarEditor.step === 'crop' ? 'avatar' : bannerEditor.step === 'crop' ? 'banner' : null
	);
	const croppedSource = $derived(cropping ? editorOf(cropping).source : null);
	const busy = $derived(avatarEditor.busy || bannerEditor.busy || bioSaving);
	const bioChanged = $derived(normalizeBio(bioDraft) !== (card.bio ?? null));
	const stage = $derived(editing ? (cropping ? 'crop' : 'edit') : 'view');
	const control = $derived(
		stage === 'view' ? 'edit' : saved ? 'done' : busy ? 'busy' : 'confirm'
	);
	const editorError = $derived(avatarEditor.error ?? bannerEditor.error ?? bioError);
	const editingState = $derived<ProfileEditing | null>(
		editing
			? {
					avatar: previewOf(avatarEditor),
					banner: previewOf(bannerEditor),
					bio: bioDraft,
					locked: busy || saved,
					onbioinput: (value) => {
						if (busy || saved) return;
						bioDraft = limitBioLines(value);
						bioError = null;
					},
					notice: saved ? 'Изменения сохранены' : (editorError ?? editingHint),
					noticeTone: saved ? 'done' : editorError !== null ? 'danger' : 'hint',
					onavatarclick: (anchor) => pickPhoto('avatar', anchor),
					onbannerclick: (anchor) => pickPhoto('banner', anchor)
				}
			: null
	);

	function previewOf(editor: ImageEditor<AvatarImages> | ImageEditor<Blob>): AvatarPreview {
		const draft = editor.draft;
		if (draft.kind === 'new') return { kind: 'draft', url: draft.url };
		return draft.kind === 'removed' ? { kind: 'none' } : { kind: 'current' };
	}

	function hasPhoto(kind: PhotoKind): boolean {
		const draft = editorOf(kind).draft;
		const current = kind === 'avatar' ? card.avatarId : card.bannerId;
		return draft.kind === 'new' || (draft.kind === 'unchanged' && current !== null);
	}

	function resetEditors() {
		avatarEditor.reset();
		bannerEditor.reset();
	}

	function startEditing() {
		resetEditors();
		bioDraft = card.bio ?? '';
		bioError = null;
		editing = true;
	}

	function stopEditing() {
		resetEditors();
		bioError = null;
		photoMenu = null;
		saved = false;
		editing = false;
	}

	function cancel() {
		if (busy || saved) return;
		if (cropping) {
			cropExit = 'cancel';
			editorOf(cropping).cancelCrop();
		} else {
			stopEditing();
		}
	}

	function openFilePicker(kind: PhotoKind) {
		pickingFor = kind;
		fileInput?.click();
	}

	function pickPhoto(kind: PhotoKind, anchor: HTMLElement) {
		if (busy || saved) return;
		if (!hasPhoto(kind)) {
			openFilePicker(kind);
			return;
		}
		if (!dialog) return;
		const target = anchor.getBoundingClientRect();
		const frame = dialog.getBoundingClientRect();
		photoMenu = {
			kind,
			left: target.left + target.width / 2 - frame.left - menuWidth / 2,
			top: target.bottom - frame.top + 8
		};
	}

	function chooseFile() {
		if (!photoMenu) return;
		const kind = photoMenu.kind;
		photoMenu = null;
		openFilePicker(kind);
	}

	function removePhoto() {
		if (!photoMenu) return;
		editorOf(photoMenu.kind).remove();
		photoMenu = null;
	}

	function takeFile(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		cropTarget = pickingFor;
		void editorOf(pickingFor).pick(file);
	}

	function targetRect(): DOMRect | null {
		return dialog?.querySelector(targetSelectors[cropTarget])?.getBoundingClientRect() ?? null;
	}

	async function saveEditor(
		editor: ImageEditor<AvatarImages> | ImageEditor<Blob>,
		onchange: (id: string | null) => void
	): Promise<boolean> {
		if (editor.draft.kind === 'unchanged') return true;
		const result = await editor.save();
		if (!result?.ok) return false;
		onchange(result.id);
		editor.reset();
		return true;
	}

	async function saveBioDraft(): Promise<boolean> {
		if (!bioChanged) return true;
		bioSaving = true;
		const result = await saveBio(bioDraft);
		bioSaving = false;
		if (!result.ok) {
			bioError = result.message;
			return false;
		}
		onbiochange(result.bio);
		return true;
	}

	async function save() {
		const photosUnchanged =
			avatarEditor.draft.kind === 'unchanged' && bannerEditor.draft.kind === 'unchanged';
		if (photosUnchanged && !bioChanged) {
			stopEditing();
			return;
		}
		const outcomes = await Promise.all([
			saveEditor(avatarEditor, onavatarchange),
			saveEditor(bannerEditor, onbannerchange),
			saveBioDraft()
		]);
		if (outcomes.includes(false)) return;
		saved = true;
		savedTimer = setTimeout(stopEditing, savedPauseMs);
	}

	function confirm() {
		if (cropping) {
			cropExit = 'apply';
			if (cropper) void editorOf(cropping).applyCrop(cropper.cropArea());
			return;
		}
		void save();
	}

	function isTypingField(target: EventTarget | null): target is HTMLTextAreaElement {
		return target instanceof HTMLTextAreaElement && (dialog?.contains(target) ?? false);
	}

	function enterControl(node: Element): TransitionConfig {
		return settle(node, { duration: 150 });
	}

	function leaveControl(node: Element): TransitionConfig {
		return settle(node, { duration: 100 });
	}

	interface Flight {
		origin: string;
		x: number;
		y: number;
		scale: number;
	}

	function isClipped(rect: DOMRect, element: HTMLElement): boolean {
		for (let parent = element.parentElement; parent; parent = parent.parentElement) {
			const style = getComputedStyle(parent);
			if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
			const bounds = parent.getBoundingClientRect();
			if (
				rect.top < bounds.top ||
				rect.bottom > bounds.bottom ||
				rect.left < bounds.left ||
				rect.right > bounds.right
			) {
				return true;
			}
		}
		return false;
	}

	function visibleRectOf(element: HTMLElement | null): DOMRect | null {
		if (!element?.isConnected) return null;
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 || isClipped(rect, element)) return null;
		return rect;
	}

	function offsetWithin(element: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
		let x = 0;
		let y = 0;
		let current: Element | null = element;
		while (current instanceof HTMLElement && current !== ancestor) {
			x += current.offsetLeft;
			y += current.offsetTop;
			current = current.offsetParent;
		}
		return { x, y };
	}

	function flightBetween(node: HTMLElement, home: DOMRect): Flight | null {
		const avatar = node.querySelector<HTMLElement>('[data-avatar]');
		const layer = node.offsetParent;
		if (!avatar || !(layer instanceof HTMLElement)) return null;
		const layerBox = layer.getBoundingClientRect();
		const offset = offsetWithin(avatar, node);
		const originX = offset.x + avatar.offsetWidth / 2;
		const originY = offset.y + avatar.offsetHeight / 2;
		return {
			origin: `${originX}px ${originY}px`,
			x: home.left + home.width / 2 - (layerBox.left + node.offsetLeft + originX),
			y: home.top + home.height / 2 - (layerBox.top + node.offsetTop + originY),
			scale: home.width / avatar.offsetWidth
		};
	}

	function isTransparent(color: string): boolean {
		return color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
	}

	function faceOf(element: Element): Element | null {
		for (const candidate of [element, ...element.querySelectorAll('*')]) {
			if (!isTransparent(getComputedStyle(candidate).backgroundColor)) return candidate;
		}
		return null;
	}

	type AnimatedProperty = 'opacity' | 'transform' | 'backgroundColor' | 'boxShadow';

	const noRing = '0 0 0 0 transparent';

	function animateOnwards(
		element: Element,
		target: Partial<Record<AnimatedProperty, string>>,
		timing: KeyframeAnimationOptions
	) {
		const current = getComputedStyle(element);
		const start: Partial<Record<AnimatedProperty, string>> = {};
		for (const property of Object.keys(target) as AnimatedProperty[]) {
			start[property] = current[property];
		}
		for (const animation of element.getAnimations()) animation.cancel();
		element.animate([start, target], timing);
	}

	function sourceLook(node: HTMLElement, flight: Flight) {
		const face = node.querySelector('[data-avatar-face]');
		const initials = node.querySelector('[data-avatar-initials]');
		const sourceFace = origin ? faceOf(origin) : null;
		if (!face || !initials || !sourceFace) return null;
		const source = getComputedStyle(sourceFace);
		const textScale =
			parseFloat(source.fontSize) / (parseFloat(getComputedStyle(face).fontSize) * flight.scale);
		return { face, initials, color: source.backgroundColor, textSize: `scale(${textScale})` };
	}

	function growFace(node: HTMLElement, flight: Flight) {
		const look = sourceLook(node, flight);
		if (!look) return;
		const timing = { duration: growMs, easing: quintOutCurve };
		const own = getComputedStyle(look.face);
		look.face.animate(
			[
				{ backgroundColor: look.color, boxShadow: noRing },
				{ backgroundColor: own.backgroundColor, boxShadow: own.boxShadow }
			],
			timing
		);
		look.initials.animate([{ transform: look.textSize }, { transform: 'scale(1)' }], timing);
	}

	function shrinkFace(node: HTMLElement, flight: Flight, timing: KeyframeAnimationOptions) {
		const look = sourceLook(node, flight);
		if (!look) return;
		animateOnwards(look.face, { backgroundColor: look.color, boxShadow: noRing }, timing);
		animateOnwards(look.initials, { transform: look.textSize }, timing);
	}

	function fadeComet(node: HTMLElement) {
		const comet = node.querySelector('[data-avatar-stage] svg');
		if (comet) animateOnwards(comet, { opacity: '0' }, { duration: 150, easing: 'ease-out', fill: 'forwards' });
	}

	function settleDot(node: HTMLElement, flight: Flight, home: DOMRect, timing: KeyframeAnimationOptions) {
		const dot = node.querySelector<HTMLElement>('[data-avatar-dot]');
		const avatar = node.querySelector<HTMLElement>('[data-avatar]');
		if (!dot || !avatar) return;
		const target = origin?.querySelector('[data-avatar-dot]');
		if (!target || getComputedStyle(target).opacity === '0') {
			animateOnwards(dot, { opacity: '0' }, timing);
			return;
		}
		const goal = target.getBoundingClientRect();
		const offset = offsetWithin(dot, avatar);
		const offsetX = offset.x + dot.offsetWidth / 2 - avatar.offsetWidth / 2;
		const offsetY = offset.y + dot.offsetHeight / 2 - avatar.offsetHeight / 2;
		const shiftX =
			(goal.left + goal.width / 2 - (home.left + home.width / 2) - offsetX * flight.scale) /
			flight.scale;
		const shiftY =
			(goal.top + goal.height / 2 - (home.top + home.height / 2) - offsetY * flight.scale) /
			flight.scale;
		const resize = goal.width / (dot.offsetWidth * flight.scale);
		const opacity = getComputedStyle(dot).opacity;
		for (const animation of dot.getAnimations()) animation.cancel();
		dot.animate(
			[
				{ opacity, transform: 'none' },
				{ opacity: '1', transform: `translate(${shiftX}px, ${shiftY}px) scale(${resize})` }
			],
			timing
		);
	}

	function growFromSource(node: HTMLElement): TransitionConfig {
		const home = prefersReducedMotion.current ? null : visibleRectOf(origin);
		const flight = home ? flightBetween(node, home) : null;
		if (!flight) return materialize(node, { y: 8, scale: 0.96, blur: 4, duration: 280 });
		growFace(node, flight);
		return {
			duration: growMs,
			easing: quintOut,
			css: (t, u) =>
				`transform-origin: ${flight.origin}; transform: translate(${flight.x * u}px, ${flight.y * u}px) scale(${flight.scale + (1 - flight.scale) * t})`
		};
	}

	function shrinkToSource(node: HTMLElement): TransitionConfig {
		content?.showStatusNow();
		const home = prefersReducedMotion.current ? null : visibleRectOf(origin);
		const flight = home ? flightBetween(node, home) : null;
		if (!flight) {
			return materialize(node, { y: 4, scale: 0.98, blur: 2, duration: 180, easing: cubicOut });
		}
		const timing = { duration: returnMs, easing: quartOutCurve, fill: 'forwards' } as const;
		fadeComet(node);
		shrinkFace(node, flight, timing);
		if (home) settleDot(node, flight, home, timing);
		return {
			duration: returnMs,
			easing: quartOut,
			css: (_t, u) =>
				`transform-origin: ${flight.origin}; transform: translate(${flight.x * u}px, ${flight.y * u}px) scale(${1 + (flight.scale - 1) * u})`
		};
	}

	function reveal(node: Element): TransitionConfig {
		return { ...materialize(node, { blur: 4, duration: 280 }), delay: 140 };
	}

	$effect(() => {
		const hidden = origin;
		if (!hidden) return;
		hidden.style.visibility = 'hidden';
		return () => {
			hidden.style.visibility = '';
		};
	});

	$effect(() => {
		dialog?.focus({ preventScroll: true });
	});

	$effect(() => {
		return on(document, 'keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			if (editing && isTypingField(event.target)) {
				event.target.blur();
				dialog?.focus({ preventScroll: true });
				return;
			}
			if (editing) cancel();
			else onclose();
		});
	});

	$effect(() => {
		const menu = menuElement;
		if (!photoMenu || !menu) return;
		const offPointer = on(document, 'pointerdown', (event) => {
			if (!menu.contains(event.target as Node)) photoMenu = null;
		});
		const offKey = on(
			document,
			'keydown',
			(event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				event.stopPropagation();
				photoMenu = null;
			},
			{ capture: true }
		);
		return () => {
			offPointer();
			offKey();
		};
	});

	$effect(() => {
		return () => {
			if (savedTimer) clearTimeout(savedTimer);
		};
	});
</script>

<button
	type="button"
	tabindex="-1"
	aria-label="Закрыть профиль"
	onclick={() => {
		if (!editing) onclose();
	}}
	transition:fade={{ duration: 200 }}
	class="absolute inset-0 z-40 cursor-default bg-bg/70"
></button>

<div class="pointer-events-none absolute inset-0 z-40 flex flex-col items-center px-8 py-6">
	<div class="grow-[2]"></div>
	<div
		bind:this={dialog}
		role="dialog"
		aria-modal="true"
		aria-label="Профиль @{card.target.username}"
		tabindex="-1"
		in:growFromSource
		out:shrinkToSource
		class="pointer-events-auto relative flex h-[452px] max-h-full min-h-0 w-full max-w-[400px] flex-col outline-none will-change-transform"
	>
		<div
			class="panel panel-floating absolute inset-0"
			in:fade={{ duration: 220 }}
			out:fade={{ duration: 100 }}
		></div>

		<SmoothScroll class="relative min-h-0 flex-1" contentClass="flex flex-col items-center p-1.5 pb-4">
			<ProfileContent
				bind:this={content}
				{card}
				cometDelay={cometDelayMs}
				animated
				editing={editingState}
			/>
		</SmoothScroll>

		{#if stage === 'crop' && croppedSource}
			<ImageCropper
				bind:this={cropper}
				source={croppedSource}
				frame={frames[cropTarget]}
				exit={cropExit}
				{targetRect}
			/>
		{/if}

		{#if photoMenu}
			<div
				bind:this={menuElement}
				role="menu"
				aria-label={photoMenu.kind === 'avatar' ? 'Фото профиля' : 'Баннер'}
				in:pop={{ y: -4, duration: 180 }}
				out:fade={{ duration: 100 }}
				class="panel panel-floating absolute z-30 origin-top p-1.5"
				style:left="{photoMenu.left}px"
				style:top="{photoMenu.top}px"
				style:width="{menuWidth}px"
			>
				<div class="flex flex-col gap-0.5">
					<MenuItem icon="image" label="Выбрать фото" onclick={chooseFile} />
					<MenuItem
						icon="trash"
						label={photoMenu.kind === 'avatar' ? 'Удалить фото' : 'Удалить баннер'}
						destructive
						onclick={removePhoto}
					/>
				</div>
			</div>
		{/if}

		<div
			class="absolute top-0 left-0 z-20 grid h-14 items-center pl-5"
			in:reveal
			out:fade={{ duration: 120 }}
		>
			{#if editing}
				<button
					type="button"
					disabled={busy || saved}
					onclick={cancel}
					in:enterControl
					out:leaveControl
					class="col-start-1 row-start-1 flex h-5 items-center text-[14px] leading-5 text-ink-secondary transition-[color,opacity] duration-150 hover:text-ink active:opacity-60 disabled:opacity-40"
				>
					Отмена
				</button>
			{/if}
		</div>

		<div
			class="absolute top-0 right-0 z-20 grid h-14 items-center justify-items-end"
			in:reveal
			out:fade={{ duration: 120 }}
		>
			{#key control === 'edit'}
				<span class="col-start-1 row-start-1 flex" in:enterControl out:leaveControl>
					{#if control === 'edit'}
						<button
							type="button"
							aria-label="Изменить профиль"
							title="Изменить профиль"
							onclick={startEditing}
							class="pressable mr-3 flex h-8 w-8 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.08] hover:text-ink"
						>
							<Icon name="pencil" size={15} />
						</button>
					{:else}
						<button
							type="button"
							disabled={control !== 'confirm'}
							aria-busy={control === 'busy'}
							onclick={confirm}
							class="mr-5 grid h-5 items-center text-[14px] leading-5 font-semibold text-ink transition-[color,opacity] duration-200 ease-soft active:opacity-60"
						>
							{#key control}
								<span
									class="col-start-1 row-start-1 flex h-5 items-center justify-end gap-1.5 whitespace-nowrap"
									in:settle
									out:settle={{ duration: 100 }}
								>
									{#if control === 'done'}
										<DrawnCheck size={14} delay={60} />
										Готово
									{:else if control === 'busy'}
										<Orbit size={16} />
									{:else}
										Готово
									{/if}
								</span>
							{/key}
						</button>
					{/if}
				</span>
			{/key}
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={(event) => takeFile(event.currentTarget)}
		/>
	</div>
	<div class="grow-[3]"></div>
</div>
