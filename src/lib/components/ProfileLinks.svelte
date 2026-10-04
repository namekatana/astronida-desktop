<script lang="ts">
	import { widgetTileClass } from '$lib/profile/widget-tile';
	import {
		displayUrl,
		linkBrandOf,
		linksMaxCount,
		linkTitle,
		type ProfileLink
	} from '$lib/profile/widgets';
	import { openExternal } from '$lib/ui/external-link';
	import BrandIcon from './BrandIcon.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		links: ProfileLink[];
		locked?: boolean;
		onedit?: (anchor: HTMLElement, index: number | null) => void;
	}

	let { links, locked = false, onedit }: Props = $props();

	const editable = $derived(onedit !== undefined);
	const canAdd = $derived(editable && links.length < linksMaxCount);

	function choose(anchor: HTMLElement, index: number, link: ProfileLink) {
		if (onedit) {
			if (!locked) onedit(anchor, index);
			return;
		}
		openExternal(link.url);
	}

	function subtitleOf(link: ProfileLink): string | null {
		const address = displayUrl(link.url);
		return address === linkTitle(link) ? null : address;
	}
</script>

<section
	data-widget-card
	class="flex h-full min-w-0 flex-col overflow-hidden px-1.5 pt-3 pb-1.5 transition-opacity duration-150 {widgetTileClass} {locked
		? 'opacity-60'
		: ''}"
>
	<div class="flex h-5 shrink-0 items-center justify-between gap-2 px-2">
		<h3 class="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-muted">
			<Icon name="link" size={13} />
			Ссылки
		</h3>
		{#if canAdd}
			<button
				type="button"
				aria-label="Добавить ссылку"
				title="Добавить ссылку"
				disabled={locked}
				onclick={(event) => onedit?.(event.currentTarget, null)}
				class="pressable -mr-1 flex h-5 w-5 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.08] hover:text-ink disabled:opacity-40"
			>
				<Icon name="plus" size={12} />
			</button>
		{/if}
	</div>

	{#if links.length === 0}
		<p class="flex flex-1 items-center justify-center gap-1.5 px-2 pb-1.5 text-center text-[12px] text-muted">
			{#if editable}
				Нажмите +, чтобы добавить ссылку
			{:else}
				<Icon name="link" size={14} class="opacity-60" />
				<span class="text-[13px]">Ссылок пока нет</span>
			{/if}
		</p>
	{/if}

	<ul class="mt-1 flex flex-col">
		{#each links as link, index (index)}
			{@const subtitle = subtitleOf(link)}
			{@const brand = linkBrandOf(link.url)}
			<li class="relative">
				<button
					type="button"
					title={link.url}
					onclick={(event) => choose(event.currentTarget, index, link)}
					onauxclick={(event) => {
						if (event.button === 1 && !editable) openExternal(link.url);
					}}
					class="group/link flex h-9 w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors duration-150 [corner-shape:squircle] hover:bg-white/[0.05] active:bg-white/[0.07]"
				>
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.08] text-ink [corner-shape:squircle]"
					>
						{#if brand}
							<BrandIcon name={brand} size={14} />
						{:else}
							<Icon name="link" size={15} />
						{/if}
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-[13px] leading-[17px] font-medium text-ink">
							{linkTitle(link)}
						</span>
						{#if subtitle}
							<span class="truncate text-[11px] leading-[13px] text-muted">{subtitle}</span>
						{/if}
					</span>
					<Icon
						name={editable ? 'chevron' : 'arrow-up-right'}
						size={12}
						class="text-muted opacity-0 transition-opacity duration-150 group-hover/link:opacity-100 {editable
							? '-rotate-90'
							: ''}"
					/>
				</button>
				{#if index < links.length - 1}
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2 bottom-0 left-[46px] h-px bg-white/[0.06]"
					></span>
				{/if}
			</li>
		{/each}
	</ul>
</section>
