<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { cachedImage, isStoredLocally, loadImage } from '$lib/media/images';
	import { thumbHashImage } from '$lib/media/thumbhash-image';
	import type { MessageAttachment } from '$lib/messages/messages';
	import Icon from './Icon.svelte';

	interface Props {
		attachment: MessageAttachment;
		label: string;
		progress?: number | null;
		waiting?: boolean;
		onopen?: (element: HTMLElement) => void;
	}

	let { attachment, label, progress = null, waiting = false, onopen }: Props = $props();

	const blurDelayMs = 150;
	const ringRadius = 15;
	const ringLength = 2 * Math.PI * ringRadius;
	const ringMinimum = 0.06;

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
</script>

<button
	type="button"
	aria-label={label}
	data-attachment-id={attachment.id}
	disabled={!onopen}
	onclick={(event) => onopen?.(event.currentTarget)}
	class="relative block h-full w-full cursor-zoom-in overflow-hidden bg-white/[0.04] disabled:cursor-default"
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
			<svg width="36" height="36" viewBox="0 0 36 36" class="animate-spin [animation-duration:1.4s]">
				<circle cx="18" cy="18" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.5" />
				<circle
					cx="18"
					cy="18"
					r={ringRadius}
					fill="none"
					stroke="white"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-dasharray={ringLength}
					stroke-dashoffset={ringLength * (1 - Math.max(ringMinimum, progress))}
					transform="rotate(-90 18 18)"
					class="transition-[stroke-dashoffset] duration-200 ease-soft"
				/>
			</svg>
		</span>
	{/if}
</button>
