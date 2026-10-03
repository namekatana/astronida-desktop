<script lang="ts">
	import { fade } from 'svelte/transition';
	import { createBannerSource } from '$lib/profile/banner-source.svelte';
	import type { AvatarPreview } from '$lib/profile/profile';
	import Icon from './Icon.svelte';

	interface Props {
		userId: string;
		bannerId: string | null;
		preview?: AvatarPreview;
		onpick?: (anchor: HTMLElement) => void;
	}

	let { userId, bannerId, preview = { kind: 'current' }, onpick }: Props = $props();

	const picture = createBannerSource(() => ({ userId, bannerId }));
	const shownUrl = $derived(
		preview.kind === 'draft' ? preview.url : preview.kind === 'none' ? null : picture.url
	);
</script>

<div
	data-banner
	class="relative h-24 w-full shrink-0 overflow-hidden rounded-[12px] bg-white/[0.06] [corner-shape:squircle]"
>
	{#if shownUrl}
		<img
			src={shownUrl}
			alt=""
			draggable="false"
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 h-full w-full object-cover select-none"
		/>
		<div
			aria-hidden="true"
			transition:fade={{ duration: 150 }}
			class="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/40 to-transparent"
		></div>
	{/if}
	{#if onpick}
		<button
			type="button"
			aria-label="Изменить баннер"
			onclick={(event) => onpick(event.currentTarget)}
			transition:fade={{ duration: 150 }}
			class="group absolute inset-0 flex items-start justify-center pt-[17px] text-ink transition-colors duration-150 hover:bg-black/45 focus-visible:bg-black/45"
		>
			<Icon
				name="camera"
				size={22}
				class="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
			/>
		</button>
	{/if}
</div>
