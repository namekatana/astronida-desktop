<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import type { ProfileEditing } from '$lib/profile/profile';
	import type { WidgetDrag } from '$lib/profile/widget-drag.svelte';
	import {
		canvasRows,
		columnsFor,
		emptyCells,
		gridGap,
		placeWidgets,
		rowHeight,
		rowsFor,
		type WidgetPlacement
	} from '$lib/profile/widget-grid';
	import {
		linksMinimumPx,
		shownWidgets,
		widgetTitles,
		type ProfileWidget,
		type WidgetType
	} from '$lib/profile/widgets';
	import type { Server } from '$lib/servers/servers';
	import { pop } from '$lib/ui/pop';
	import Icon from './Icon.svelte';
	import ProfileBio from './ProfileBio.svelte';
	import ProfileLinks from './ProfileLinks.svelte';
	import ProfileServerWidget from './ProfileServerWidget.svelte';

	interface Props {
		bio: string | null;
		widgets: ProfileWidget[] | null;
		editing: ProfileEditing | null;
		onopenserver?: (server: Server) => void;
	}

	let { bio, widgets, editing, onopenserver }: Props = $props();

	const glideMs = 260;
	const removeMs = 160;
	const settleTransition = 'width 220ms cubic-bezier(0.22, 1, 0.36, 1), height 220ms cubic-bezier(0.22, 1, 0.36, 1)';
	const quintOutCurve = 'cubic-bezier(0.22, 1, 0.36, 1)';
	const fallbackWidth = 408;
	const interactive = 'textarea, input, [data-drag-chrome]';

	let gridWidth = $state(0);
	let removing = $state<WidgetType | null>(null);
	let bioRows = $state(1);

	const drag = $derived(editing?.widgets.drag ?? null);
	const columns = $derived(editing ? 2 : columnsFor(gridWidth || fallbackWidth));
	const list = $derived(editing ? editing.widgets.list : shownWidgets(widgets));
	const placements = $derived(
		placeWidgets(
			list.map((widget) => ({ width: widget.width, height: widget.height })),
			columns
		)
	);
	const freeCells = $derived(editing ? emptyCells(placements) : []);
	const linksRows = $derived.by(() => {
		const links = list.find((widget) => widget.type === 'links');
		return links?.type === 'links' ? rowsFor(linksMinimumPx(links.links.length)) : 1;
	});
	const layoutKey = $derived(
		list
			.map((widget, index) => {
				const placement = placements[index];
				return `${widget.type}:${placement.column}:${placement.row}:${placement.width}:${placement.height}`;
			})
			.join('|')
	);

	const cells = new Map<WidgetType, HTMLElement>();
	const flights = new Map<HTMLElement, Animation>();
	let before = new Map<WidgetType, DOMRect>();

	function gridColumn(placement: WidgetPlacement): string {
		return columns === 1 ? '1 / -1' : `${placement.column} / span ${placement.width}`;
	}

	function gridRow(placement: WidgetPlacement): string {
		return `${placement.row} / span ${placement.height}`;
	}

	function resizeEdge(placement: WidgetPlacement): 'start' | 'end' {
		return placement.width === 1 && placement.column === 2 ? 'start' : 'end';
	}

	function cell(node: HTMLElement, params: { type: WidgetType; drag: WidgetDrag | null }) {
		function register(current: { type: WidgetType; drag: WidgetDrag | null }) {
			cells.set(current.type, node);
			const registration = current.drag?.cell(node, current.type);
			return () => {
				if (cells.get(current.type) === node) cells.delete(current.type);
				registration?.destroy();
			};
		}
		let release = register(params);
		return {
			update(next: { type: WidgetType; drag: WidgetDrag | null }) {
				release();
				release = register(next);
			},
			destroy() {
				release();
			}
		};
	}

	function gridHost(node: HTMLElement, current: WidgetDrag | null) {
		let registration = current?.grid(node);
		return {
			update(next: WidgetDrag | null) {
				registration?.destroy();
				registration = next?.grid(node);
			},
			destroy() {
				registration?.destroy();
			}
		};
	}

	function glide() {
		if (prefersReducedMotion.current) return;
		for (const [type, node] of cells) {
			const from = before.get(type);
			if (!from || drag?.resizing?.type === type) continue;
			flights.get(node)?.cancel();
			const to = node.getBoundingClientRect();
			const dx = from.left - to.left;
			const dy = from.top - to.top;
			if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
			flights.set(
				node,
				node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
					duration: glideMs,
					easing: quintOutCurve
				})
			);
		}
	}

	$effect.pre(() => {
		void layoutKey;
		untrack(() => {
			before = new Map([...cells].map(([type, node]) => [type, node.getBoundingClientRect()]));
		});
	});

	$effect(() => {
		void layoutKey;
		untrack(glide);
	});

	function keepFitting(type: WidgetType, rows: number) {
		if (!editing || !drag) return;
		drag.setContentRows(type, rows);
		if (!drag.ensureMinimum(type)) editing.widgets.onoverflow(type);
	}

	$effect(() => {
		const rows = bioRows;
		untrack(() => keepFitting('bio', rows));
	});

	$effect(() => {
		const rows = linksRows;
		untrack(() => keepFitting('links', rows));
	});

	function grab(event: PointerEvent & { currentTarget: HTMLElement }, type: WidgetType) {
		if (!drag || removing) return;
		if ((event.target as Element).closest(interactive)) return;
		drag.start(event, type, 'grid', event.currentTarget);
	}

	function remove(type: WidgetType) {
		if (!editing || removing || editing.locked) return;
		removing = type;
		const onremove = editing.widgets.onremove;
		setTimeout(
			() => {
				onremove(type);
				removing = null;
			},
			prefersReducedMotion.current ? 0 : removeMs
		);
	}
</script>

{#if list.length > 0 || editing}
	<div
		bind:clientWidth={gridWidth}
		use:gridHost={drag}
		class="relative grid min-w-0 {columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}"
		style:gap="{gridGap}px"
		style:grid-template-rows={editing ? `repeat(${canvasRows}, ${rowHeight}px)` : null}
		style:grid-auto-rows={editing ? null : `minmax(${rowHeight}px, auto)`}
	>
		{#each freeCells as free (`${free.row}:${free.column}`)}
			<div
				aria-hidden="true"
				class="pointer-events-none rounded-[14px] border border-dashed border-white/[0.07] [corner-shape:squircle]"
				style:grid-column="{free.column} / span 1"
				style:grid-row="{free.row} / span 1"
				in:fade={{ duration: 150 }}
			></div>
		{/each}

		{#each list as widget, index (widget.type)}
			{@const placement = placements[index]}
			{@const lifted = drag?.active === widget.type}
			{@const hidden = lifted || drag?.landing === widget.type}
			{@const resize = drag?.resizing?.type === widget.type ? drag.resizing : null}
			<div
				use:cell={{ type: widget.type, drag }}
				role={editing ? 'group' : undefined}
				aria-label={editing ? widgetTitles[widget.type] : undefined}
				onpointerdown={(event) => grab(event, widget.type)}
				in:pop={{ duration: editing ? 200 : 0 }}
				class="group/widget relative min-w-0 {editing
					? 'cursor-grab'
					: ''} transition-[opacity,scale] duration-150 ease-soft {removing === widget.type
					? 'scale-95 opacity-0'
					: ''}"
				style:grid-column={gridColumn(placement)}
				style:grid-row={gridRow(placement)}
				style:width={resize ? `${resize.width}px` : null}
				style:height={resize ? `${resize.height}px` : null}
				style:justify-self={resize?.anchor ?? null}
				style:align-self={resize ? 'start' : null}
				style:z-index={resize ? 10 : null}
				style:transition={resize?.settling ? settleTransition : null}
			>
				<div data-widget-body class="h-full {hidden ? 'opacity-0' : ''}" inert={hidden}>
					{#if widget.type === 'bio'}
						<ProfileBio
							bio={editing ? null : bio}
							draft={editing?.bio ?? null}
							locked={editing?.locked ?? false}
							oninput={editing?.onbioinput}
							onmeasure={editing ? (px) => (bioRows = rowsFor(px)) : undefined}
						/>
					{:else if widget.type === 'links'}
						<ProfileLinks
							links={widget.links}
							locked={editing?.locked ?? false}
							onedit={editing?.widgets.onlinkedit}
						/>
					{:else}
						<ProfileServerWidget
							serverId={widget.serverId}
							inviteCode={widget.inviteCode}
							compact={widget.height === 1}
							knownServers={editing?.widgets.ownedServers ?? []}
							locked={editing?.locked ?? false}
							onpick={editing?.widgets.onserverpick}
							onopen={onopenserver}
						/>
					{/if}
				</div>

				{#if lifted}
					<div
						data-drag-chrome
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 rounded-[14px] border border-dashed border-white/20 bg-white/[0.02] [corner-shape:squircle]"
					></div>
				{/if}

				{#if editing && !hidden}
					<button
						type="button"
						data-drag-chrome
						aria-label="Убрать виджет «{widgetTitles[widget.type]}»"
						title="Убрать"
						disabled={editing.locked}
						onclick={() => remove(widget.type)}
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 100 }}
						class="pressable absolute -top-1.5 -left-1.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#48484c] text-ink transition-[opacity,color,background-color] duration-150 hover:bg-[#525257] hover:text-danger disabled:opacity-40 {drag?.busy
							? 'opacity-0'
							: ''}"
					>
						<Icon name="minus" size={13} />
					</button>

					<span
						data-drag-handle
						aria-hidden="true"
						title="Перетащить"
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 100 }}
						class="absolute top-0 left-1/2 z-10 flex h-3.5 w-10 -translate-x-1/2 cursor-grab items-center justify-center text-muted transition-[opacity,color] duration-150 group-hover/widget:text-ink-secondary hover:text-ink {drag?.busy
							? 'opacity-0'
							: ''}"
					>
						<Icon name="grip" size={16} class="[stroke-width:2.4]" />
					</span>

					<div
						data-drag-chrome
						role="separator"
						aria-label="Размер виджета «{widgetTitles[widget.type]}»"
						onpointerdown={(event) => {
							const host = event.currentTarget.parentElement;
							if (host) drag?.startResize(event, widget.type, host, resizeEdge(placement));
						}}
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 100 }}
						class="absolute bottom-0 z-10 flex h-6 w-6 items-end p-[5px] {resizeEdge(placement) ===
						'end'
							? 'right-0 cursor-nwse-resize justify-end'
							: 'left-0 cursor-nesw-resize justify-start'}"
					>
						<span
							class="block h-2.5 w-2.5 border-b-2 transition-[opacity,border-color] duration-150 {resizeEdge(
								placement
							) === 'end'
								? 'rounded-br-[6px] border-r-2'
								: 'rounded-bl-[6px] border-l-2'} {resize
								? 'border-white/80 opacity-100'
								: 'border-white/40 opacity-0 group-hover/widget:opacity-100'} {drag?.active
								? 'opacity-0'
								: ''}"
						></span>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
