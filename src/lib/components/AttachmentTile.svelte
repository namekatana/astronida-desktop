<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { cachedImage, isStoredLocally, loadImage } from '$lib/media/images';
	import { spoilers, type ScreenPoint } from '$lib/media/spoilers.svelte';
	import { thumbHashImage } from '$lib/media/thumbhash-image';
	import type { MessageAttachment } from '$lib/messages/messages';
	import Icon from './Icon.svelte';
	import SpoilerCover from './SpoilerCover.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		attachment: MessageAttachment;
		label: string;
		spoilerKey: string;
		progress?: number | null;
		waiting?: boolean;
		onopen?: (element: HTMLElement) => void;
		onreveal?: (origin: ScreenPoint | null) => void;
	}

	let {
		attachment,
		label,
		spoilerKey,
		progress = null,
		waiting = false,
		onopen,
		onreveal
	}: Props = $props();

	const coverFadeMs = 450;
	const reducedCoverFadeMs = 200;
	const blurDelayMs = 150;

	const instantUrl = $derived(attachment.localUrl ?? cachedImage(attachment, 'feed'));
	let loadedUrl = $state<string | null>(null);
	let blurShown = $state(false);
	const placeholder = $derived(blurShown ? thumbHashImage(attachment.thumbHash) : null);

	$effect(() => {
		if (instantUrl) return;
		const target = attachment;
		let active = true;
		if (!isStoredLocally(target, 'feed')) blurShown = true;
		const blurTimer = setTimeout(() => (blurShown = true), blurDelayMs);
		const attempt = () => {
			void loadImage(target, 'feed').then((url) => {
				if (!active || !url) return;
				clearTimeout(blurTimer);
				loadedUrl = url;
			});
		};
		attempt();
		window.addEventListener('online', attempt);
		return () => {
			active = false;
			clearTimeout(blurTimer);
			window.removeEventListener('online', attempt);
		};
	});

	const covered = $derived(attachment.spoiler && !spoilers.isRevealed(spoilerKey));
	const revealable = $derived(Boolean(instantUrl || loadedUrl) && progress === null && !waiting);
	let focusing = $state(false);
	let wasCovered = untrack(() => covered);

	$effect(() => {
		const nowCovered = covered;
		if (wasCovered && !nowCovered) focusing = true;
		wasCovered = nowCovered;
	});

	function revealState() {
		return spoilers.isRevealed(spoilerKey) ? { origin: spoilers.originOf(spoilerKey) } : null;
	}

	function handleClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		if (!covered) {
			onopen?.(event.currentTarget);
			return;
		}
		if (!revealable) return;
		const fromKeyboard = event.detail === 0;
		onreveal?.(fromKeyboard ? null : { x: event.clientX, y: event.clientY });
	}
</script>

<button
	type="button"
	aria-label={covered ? 'Показать фото под спойлером' : label}
	data-attachment-id={attachment.id}
	disabled={covered ? !onreveal : !onopen}
	onclick={handleClick}
	class="group relative block h-full w-full overflow-hidden disabled:cursor-default {instantUrl ||
	loadedUrl
		? ''
		: 'bg-white/[0.04]'} {covered
		? revealable
			? 'cursor-pointer'
			: 'cursor-default'
		: 'cursor-zoom-in'}"
>
	<span
		class="absolute inset-0 block {focusing ? 'spoiler-focus' : ''}"
		onanimationend={() => (focusing = false)}
	>
		{#if placeholder}
			<img
				src={placeholder}
				alt=""
				aria-hidden="true"
				draggable="false"
				class="absolute inset-0 h-full w-full object-cover"
			/>
		{/if}
		{#if instantUrl}
			<img
				src={instantUrl}
				alt=""
				draggable="false"
				decoding="sync"
				class="absolute inset-0 h-full w-full object-cover"
			/>
		{:else if loadedUrl}
			<img
				src={loadedUrl}
				alt=""
				draggable="false"
				in:fade={{ duration: blurShown ? 220 : 0, easing: cubicOut }}
				class="absolute inset-0 h-full w-full object-cover"
			/>
		{/if}
	</span>
	{#if covered}
		<span
			out:fade={{
				duration: prefersReducedMotion.current ? reducedCoverFadeMs : coverFadeMs,
				easing: cubicOut
			}}
			class="absolute inset-0 block"
		>
			<SpoilerCover
				thumbHash={attachment.thumbHash}
				showLabel={revealable}
				revealed={revealState}
			/>
		</span>
	{/if}
	{#if waiting}
		<span
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 flex items-center justify-center"
		>
			<span class="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
				<Icon name="clock" size={18} />
			</span>
		</span>
	{:else if progress !== null}
		<span
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 flex items-center justify-center bg-black/30"
		>
			<Orbit {progress} label="Загрузка фото" class="text-white" />
		</span>
	{/if}
</button>
