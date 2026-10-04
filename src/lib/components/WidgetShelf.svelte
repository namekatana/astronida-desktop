<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { WidgetDrag } from '$lib/profile/widget-drag.svelte';
	import { spanPx } from '$lib/profile/widget-grid';
	import {
		widgetTitles,
		widgetTypes,
		type ProfileLink,
		type ShelfState,
		type WidgetType
	} from '$lib/profile/widgets';
	import Icon from './Icon.svelte';
	import ProfileBio from './ProfileBio.svelte';
	import ProfileLinks from './ProfileLinks.svelte';
	import ProfileServerWidget from './ProfileServerWidget.svelte';

	interface Props {
		drag: WidgetDrag;
		states: Record<WidgetType, ShelfState>;
		locked: boolean;
		bio: string | null;
		onadd: (type: WidgetType) => void;
	}

	let { drag, states, locked, bio, onadd }: Props = $props();

	const previewHeight = spanPx(2);
	const sampleBio = 'Пишу музыку и собираю клавиатуры';
	const sampleLinks: ProfileLink[] = [
		{ url: 'https://github.com/', label: 'GitHub' },
		{ url: 'https://t.me/', label: 'Telegram' },
		{ url: 'https://youtube.com/', label: 'YouTube' }
	];
	const sampleServer = { name: 'Astronida', memberCount: 128 };

	const stateLabels: Record<Exclude<ShelfState, 'available'>, string> = {
		placed: 'В профиле',
		full: 'Нет места',
		'no-server': 'Нужен свой сервер'
	};

	const removing = $derived(drag.origin === 'grid' && drag.overShelf);

	function grab(event: PointerEvent & { currentTarget: HTMLElement }, type: WidgetType) {
		if (locked || states[type] !== 'available') return;
		drag.start(event, type, 'shelf', event.currentTarget, () => onadd(type));
	}
</script>

<div use:drag.shelf class="panel panel-floating relative flex h-full flex-col overflow-hidden">
	<div class="flex h-14 shrink-0 items-center justify-center">
		<h2 class="text-[15px] leading-5 font-semibold text-ink">Виджеты</h2>
	</div>
	<p class="-mt-2 shrink-0 pb-4 text-center text-[12px] leading-4 text-muted">
		Перетащите в профиль
	</p>

	<div class="scrollbar-none flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto pb-4">
		{#each widgetTypes as type (type)}
			{@const carried = drag.active === type && drag.origin === 'shelf'}
			{@const state = carried ? 'available' : states[type]}
			{@const available = state === 'available'}
			<div class="relative w-[200px] shrink-0" style:height="{previewHeight}px">
				{#if carried}
					<div
						aria-hidden="true"
						class="absolute inset-0 rounded-[14px] border border-dashed border-white/20 bg-white/[0.02] [corner-shape:squircle]"
						in:fade={{ duration: 120 }}
					></div>
				{/if}

				<button
					type="button"
					use:drag.shelfCard={type}
					disabled={!available || locked}
					aria-label={available
						? `Добавить виджет «${widgetTitles[type]}»`
						: `${widgetTitles[type]} — ${stateLabels[state as Exclude<ShelfState, 'available'>]}`}
					onpointerdown={(event) => grab(event, type)}
					onclick={(event) => {
						if (event.detail === 0 && available && !locked) onadd(type);
					}}
					class="block h-full w-full origin-center text-left transition-[translate,scale,opacity] duration-200 ease-soft motion-reduce:transition-none {available
						? 'cursor-grab hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]'
						: 'opacity-35'} {carried ? 'opacity-0' : ''}"
				>
					<div class="pointer-events-none h-full [&_p]:line-clamp-4" aria-hidden="true">
						{#if type === 'bio'}
							<ProfileBio bio={bio ?? sampleBio} />
						{:else if type === 'links'}
							<ProfileLinks links={sampleLinks} />
						{:else}
							<ProfileServerWidget
								serverId=""
								inviteCode={null}
								compact={false}
								sample={sampleServer}
							/>
						{/if}
					</div>
				</button>

				{#if !available}
					<span
						class="pointer-events-none absolute top-3 right-3.5 flex h-5 items-center gap-1 text-[11px] font-medium text-ink-secondary"
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 100 }}
					>
						{#if state === 'placed'}
							<Icon name="check" size={11} />
						{/if}
						{stateLabels[state as Exclude<ShelfState, 'available'>]}
					</span>
				{/if}
			</div>
		{/each}
	</div>

	{#if removing}
		<div
			class="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-2 bg-surface/90 pb-12 text-[13px] text-danger"
			transition:fade={{ duration: 120 }}
		>
			<div
				class="absolute inset-2 rounded-[12px] border border-dashed border-danger/40 [corner-shape:squircle]"
			></div>
			<Icon name="trash" size={18} />
			Отпустите, чтобы убрать
		</div>
	{/if}
</div>
