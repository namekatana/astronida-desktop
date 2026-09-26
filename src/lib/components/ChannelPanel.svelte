<script lang="ts">
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
		width: number;
		onselect: (channelId: string) => void;
		onprefetch: (channelId: string) => void;
		oncreatecategory: () => void;
		oncreatechannel: (kind: ChannelKind) => void;
	}

	let {
		serverName,
		categories,
		channels,
		selectedChannelId,
		voiceOccupants,
		width = $bindable(),
		onselect,
		onprefetch,
		oncreatecategory,
		oncreatechannel
	}: Props = $props();

	const uncategorized = $derived(channels.filter((channel) => channel.categoryId === null));
	const channelsOf = (categoryId: string) =>
		channels.filter((channel) => channel.categoryId === categoryId);

	let collapsed = $state<Record<string, boolean>>({});

	function toggle(categoryId: string) {
		collapsed[categoryId] = !collapsed[categoryId];
	}
</script>

<aside class="panel relative flex shrink-0 flex-col" style="width: {width}px">
	<div class="flex items-center gap-1 pr-3 pb-[7px] pl-5 pt-[11px]">
		<ConnectionTitle title={serverName} class="flex-1" />
		<button
			type="button"
			aria-label="Пригласить"
			title="Скоро"
			class="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-ink"
		>
			<Icon name="user-plus" size={16} />
		</button>
		<ServerMenu {oncreatecategory} {oncreatechannel} />
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<div class="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
		{#if uncategorized.length > 0}
			<div class="mb-2">
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
			<div class="mb-2">
				<button
					type="button"
					aria-expanded={!isCollapsed}
					onclick={() => toggle(category.id)}
					class="flex h-7 w-full items-center gap-1.5 px-2 text-[11px] font-medium tracking-[0.1em] text-muted uppercase transition-colors duration-150 hover:text-ink"
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
	</div>

	<ResizeHandle side="right" bind:width min={panelLimits.min} max={panelLimits.max} />
</aside>
