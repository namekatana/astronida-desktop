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
	import { settle } from '$lib/ui/settle';
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

	const widgetHints: Record<WidgetType, string> = {
		bio: 'До 190 символов',
		links: 'До 5 ссылок',
		server: 'Приглашение на ваш сервер'
	};

	const stateLabels: Record<Exclude<ShelfState, 'available'>, string> = {
		placed: 'В профиле',
		full: 'Нет места',
		'no-server': 'Нужен свой сервер'
	};

	const previews = new Map<WidgetType, HTMLElement>();

	function preview(node: HTMLElement, type: WidgetType) {
		previews.set(type, node);
		const registered = drag.shelfCard(node, type);
		return {
			destroy() {
				if (previews.get(type) === node) previews.delete(type);
				registered.destroy();
			}
		};
	}

	const removing = $derived(drag.origin === 'grid' && drag.overShelf);

	function grab(event: PointerEvent, type: WidgetType) {
		const source = previews.get(type);
		if (locked || states[type] !== 'available' || !source) return;
		drag.start(event, type, 'shelf', source, () => onadd(type));
	}
</script>

<div use:drag.shelf class="panel panel-floating relative flex h-full flex-col overflow-hidden">
	<div class="flex h-14 shrink-0 flex-col items-center justify-center">
		<h2 class="text-[15px] leading-5 font-semibold text-ink">Виджеты</h2>
		<p class="text-[12px] leading-4 text-muted">Перетащите в профиль</p>
	</div>

	<div class="scrollbar-none flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3.5 pt-1 pb-4">
		{#each widgetTypes as type (type)}
			{@const carried = drag.active === type && drag.origin === 'shelf'}
			{@const state = carried ? 'available' : states[type]}
			{@const available = state === 'available' && !locked}
			<div class="shrink-0">
				<div
					role="presentation"
					onpointerdown={(event) => grab(event, type)}
					style:--widget-backdrop="var(--color-surface-deep)"
					class="group flex items-center justify-center rounded-[14px] bg-surface-deep py-[11px] transition-colors duration-200 ease-soft [corner-shape:squircle] motion-reduce:transition-none {available
						? 'cursor-grab hover:bg-[color-mix(in_srgb,var(--color-surface-deep)_96%,white)]'
						: ''}"
				>
					<div class="relative w-[200px] shrink-0" style:height="{previewHeight}px">
						{#if carried}
							<div
								aria-hidden="true"
								class="absolute inset-0 rounded-[14px] border border-dashed border-white/20 [corner-shape:squircle]"
								in:fade={{ duration: 120 }}
							></div>
						{/if}
						<div
							use:preview={type}
							aria-hidden="true"
							class="pointer-events-none h-full origin-center transition-[scale,opacity] duration-200 ease-soft motion-reduce:transition-none [&_p]:line-clamp-4 {available
								? 'group-active:scale-[0.98]'
								: ''} {carried ? 'opacity-0' : ''}"
						>
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
					</div>
				</div>

				<div class="mt-2.5 flex items-center gap-3 px-1">
					<div class="min-w-0 flex-1">
						<h3 class="truncate text-[13px] leading-4 font-semibold text-ink">
							{widgetTitles[type]}
						</h3>
						<p class="truncate text-[12px] leading-4 text-muted">{widgetHints[type]}</p>
					</div>
					<div class="grid shrink-0 justify-items-end">
						{#key state}
							<div
								class="col-start-1 row-start-1 flex items-center"
								in:settle
								out:settle={{ duration: 100 }}
							>
								{#if state === 'available'}
									<button
										type="button"
										disabled={locked}
										aria-label={`Добавить виджет «${widgetTitles[type]}»`}
										onclick={() => onadd(type)}
										class="pressable h-6 rounded-full bg-white/[0.08] px-2.5 text-[12px] font-semibold text-ink hover:bg-white/[0.12] disabled:opacity-40"
									>
										Добавить
									</button>
								{:else}
									<span class="flex items-center gap-1 text-[12px] font-medium text-muted">
										{#if state === 'placed'}
											<Icon name="check" size={11} />
										{/if}
										{stateLabels[state]}
									</span>
								{/if}
							</div>
						{/key}
					</div>
				</div>
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
