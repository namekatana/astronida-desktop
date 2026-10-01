<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Category, Channel, ChannelKind } from '$lib/channels/channels';
	import { panelLimits } from '$lib/ui/panel-widths.svelte';
	import type { VoiceOccupant } from '$lib/voice/occupant';
	import ChannelList from './ChannelList.svelte';
	import ConnectionTitle from './ConnectionTitle.svelte';
	import Icon from './Icon.svelte';
	import ResizeHandle from './ResizeHandle.svelte';
	import ServerMenu from './ServerMenu.svelte';

	interface Props {
		serverName: string;
		categories: Category[];
		channels: Channel[];
		selectedChannelId: string | null;
		voiceOccupants: Record<string, VoiceOccupant[]>;
		loading?: boolean;
		width: number;
		onselect: (channelId: string) => void;
		onprefetch: (channelId: string) => void;
		oncreatecategory: () => void;
		oncreatechannel: (kind: ChannelKind) => void;
		oninvite: () => void;
		onprefetchinvite: () => void;
	}

	let {
		serverName,
		categories,
		channels,
		selectedChannelId,
		voiceOccupants,
		loading = false,
		width = $bindable(),
		onselect,
		onprefetch,
		oncreatecategory,
		oncreatechannel,
		oninvite,
		onprefetchinvite
	}: Props = $props();

	const uncategorized = $derived(channels.filter((channel) => channel.categoryId === null));
	const channelsOf = (categoryId: string) =>
		channels.filter((channel) => channel.categoryId === categoryId);

	const skeletonRows = [
		{ opacity: 1, width: 62 },
		{ opacity: 0.85, width: 48 },
		{ opacity: 0.7, width: 70 },
		{ opacity: 0.55, width: 40 },
		{ opacity: 0.4, width: 56 },
		{ opacity: 0.25, width: 44 }
	];

	let collapsed = $state<Record<string, boolean>>({});

	function toggle(categoryId: string) {
		collapsed[categoryId] = !collapsed[categoryId];
	}
</script>

<aside class="panel relative flex shrink-0 flex-col" style="width: {width}px">
	<div class="flex items-center gap-1 pt-3 pr-3 pb-2 pl-5">
		<ConnectionTitle title={serverName} class="flex-1" />
		<button
			type="button"
			aria-label="Пригласить друзей"
			onclick={oninvite}
			onpointerenter={onprefetchinvite}
			onfocus={onprefetchinvite}
			class="pressable flex h-8 w-8 items-center justify-center rounded-full text-muted duration-200 hover:bg-white/[0.06] hover:text-ink"
		>
			<Icon name="user-plus" size={16} />
		</button>
		<ServerMenu {oncreatecategory} {oncreatechannel} />
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<div class="scrollbar-none grid min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
		{#if loading}
			<div aria-hidden="true" class="col-start-1 row-start-1" out:fade={{ duration: 120 }}>
				<div class="flex h-7 items-center px-2">
					<span class="skeleton h-2 w-20 rounded-full"></span>
				</div>
				<div class="flex flex-col pt-0.5">
					{#each skeletonRows as row, index (index)}
						<div class="flex h-9 items-center gap-2.5 px-2.5" style="opacity: {row.opacity}">
							<span class="skeleton h-4 w-4 shrink-0 rounded-[5px]"></span>
							<span class="skeleton h-2.5 rounded-full" style="width: {row.width}%"></span>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="col-start-1 row-start-1" in:fade={{ duration: 150 }}>
				{@render channelTree()}
			</div>
		{/if}
	</div>

	<ResizeHandle side="right" bind:width min={panelLimits.min} max={panelLimits.max} />
</aside>

{#snippet channelTree()}
	{#if uncategorized.length > 0}
		<div class="mb-4">
			<ChannelList
				channels={uncategorized}
				{selectedChannelId}
				{voiceOccupants}
				{onselect}
				{onprefetch}
			/>
		</div>
	{/if}

	{#each categories as category (category.id)}
		{@const isCollapsed = collapsed[category.id] === true}
		<div class="mb-4">
			<button
				type="button"
				aria-expanded={!isCollapsed}
				onclick={() => toggle(category.id)}
				class="flex h-7 w-full items-center gap-1.5 px-2 text-[12px] font-bold text-muted transition-colors duration-150 hover:text-ink"
			>
				<Icon
					name="chevron"
					size={12}
					class="transition-transform duration-200 ease-soft {isCollapsed ? '-rotate-90' : ''}"
				/>
				<span class="min-w-0 truncate">{category.name}</span>
			</button>

			<div class="collapsible {isCollapsed ? '' : 'is-open'}" inert={isCollapsed}>
				<div>
					<div class="pt-0.5">
						<ChannelList
							channels={channelsOf(category.id)}
							{selectedChannelId}
							{voiceOccupants}
							{onselect}
							{onprefetch}
						/>
					</div>
				</div>
			</div>
		</div>
	{/each}

	{#if channels.length === 0 && categories.length === 0}
		<p class="px-2 pt-2 text-[13px] text-muted">Каналов пока нет — создай через «⋯»</p>
	{/if}
{/snippet}
