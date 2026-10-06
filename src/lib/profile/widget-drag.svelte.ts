import { tick } from 'svelte';
import { on } from 'svelte/events';
import { prefersReducedMotion } from 'svelte/motion';
import type { SmoothScrollController } from '$lib/ui/smooth-scroll';
import {
	canvasColumns,
	canvasRows,
	centerDistance,
	contains,
	emptyCells,
	gridGap,
	layoutFits,
	moveBefore,
	placeWidgets,
	rowHeight,
	snappedHeight,
	snappedWidth,
	spanPx,
	type Box
} from './widget-grid';
import {
	sizeMinimumRows,
	type ProfileWidget,
	type WidgetType,
	type WidgetWidth
} from './widgets';

export type DragOrigin = 'grid' | 'shelf';
export type ResizeEdge = 'start' | 'end';

export interface WidgetResize {
	type: WidgetType;
	width: number;
	height: number;
	anchor: ResizeEdge;
	snapping: boolean;
	settling: boolean;
}

interface Gesture {
	type: WidgetType;
	origin: DragOrigin;
	source: HTMLElement;
	pointerId: number;
	startX: number;
	startY: number;
	x: number;
	y: number;
	offsetX: number;
	offsetY: number;
	started: boolean;
	initial: ProfileWidget[];
	settledX: number;
	settledY: number;
	pendingTarget: number | null;
	pendingSince: number;
	onclick?: () => void;
}

interface Ghost {
	outer: HTMLDivElement;
	inner: HTMLDivElement;
	card: HTMLElement | null;
	x: number;
	y: number;
	width: number;
	height: number;
}

const dragThreshold = 4;
const resettleDistance = 8;
const edgeScrollZone = 40;
const edgeScrollSpeed = 9;
const zoneMargin = 24;
const liftScale = 1.03;
const liftMs = 180;
const landMs = 320;
const morphMs = 220;
const reorderDwellMs = 150;
const resizeSettleMs = 220;
const resizeStretchPx = 8;
const resizeSnapMs = 160;

function stretched(delta: number): number {
	return (resizeStretchPx * delta) / (Math.abs(delta) + resizeStretchPx * 4);
}
const quintOutCurve = 'cubic-bezier(0.22, 1, 0.36, 1)';
function opaqueCardBackground(source: HTMLElement): string {
	const backdrop = getComputedStyle(source).getPropertyValue('--widget-backdrop').trim();
	return `color-mix(in srgb, ${backdrop || 'var(--color-surface)'} 95%, white)`;
}

function layoutBox(element: HTMLElement, grid: HTMLElement): Box {
	const gridBox = grid.getBoundingClientRect();
	return {
		left: gridBox.left + element.offsetLeft,
		top: gridBox.top + element.offsetTop,
		width: element.offsetWidth,
		height: element.offsetHeight
	};
}

function copyFieldValues(source: HTMLElement, clone: HTMLElement) {
	const sourceFields = source.querySelectorAll('textarea, input');
	const cloneFields = clone.querySelectorAll('textarea, input');
	sourceFields.forEach((field, index) => {
		const copy = cloneFields[index];
		if (copy instanceof HTMLTextAreaElement || copy instanceof HTMLInputElement) {
			copy.value = (field as HTMLTextAreaElement | HTMLInputElement).value;
		}
	});
}

interface GhostFace {
	face: HTMLDivElement;
	card: HTMLElement | null;
	width: number;
	height: number;
}

function cloneFace(source: HTMLElement, width: number, height: number): GhostFace {
	const face = document.createElement('div');
	const clone = source.cloneNode(true) as HTMLElement;
	copyFieldValues(source, clone);
	clone
		.querySelectorAll('[data-drag-chrome], [data-drag-handle]')
		.forEach((chrome) => chrome.remove());
	clone.querySelectorAll<HTMLElement>('[data-widget-body]').forEach((body) => {
		body.style.opacity = '1';
	});
	clone.removeAttribute('id');
	Object.assign(clone.style, {
		width: '100%',
		height: '100%',
		margin: '0',
		opacity: '1',
		transform: 'none',
		scale: 'none',
		translate: 'none'
	});
	const card = clone.querySelector<HTMLElement>('[data-widget-card]');
	if (card) card.style.backgroundColor = opaqueCardBackground(source);
	Object.assign(face.style, {
		position: 'absolute',
		left: '0px',
		top: '0px',
		width: `${width}px`,
		height: `${height}px`
	});
	face.appendChild(clone);
	return { face, card, width, height };
}

function createGhost(source: HTMLElement): Ghost {
	const rect = source.getBoundingClientRect();
	const outer = document.createElement('div');
	const inner = document.createElement('div');
	const first = cloneFace(source, rect.width, rect.height);
	Object.assign(outer.style, {
		position: 'fixed',
		left: '0px',
		top: '0px',
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		zIndex: '60',
		pointerEvents: 'none',
		transformOrigin: '0 0',
		willChange: 'transform',
		transition: [
			`width ${morphMs}ms ${quintOutCurve}`,
			`height ${morphMs}ms ${quintOutCurve}`
		].join(', ')
	});
	Object.assign(inner.style, {
		position: 'relative',
		width: '100%',
		height: '100%',
		transformOrigin: 'center',
		transition: `scale 180ms ${quintOutCurve}, opacity 180ms ease-out`
	});
	inner.setAttribute('aria-hidden', 'true');
	inner.appendChild(first.face);
	outer.appendChild(inner);
	document.body.appendChild(outer);
	return {
		outer,
		inner,
		card: first.card,
		x: rect.left,
		y: rect.top,
		width: rect.width,
		height: rect.height
	};
}

function placeGhost(ghost: Ghost, x: number, y: number) {
	ghost.x = x;
	ghost.y = y;
	ghost.outer.style.transform = `translate(${x}px, ${y}px)`;
}

export function createWidgetDrag(options: {
	widgets: () => ProfileWidget[];
	update: (next: ProfileWidget[]) => void;
	create: (type: WidgetType) => ProfileWidget;
	locked: () => boolean;
	scroll: () => { viewport: HTMLElement | undefined; controller: SmoothScrollController | undefined };
}) {
	let active = $state<WidgetType | null>(null);
	let origin = $state<DragOrigin | null>(null);
	let overShelf = $state(false);
	let landing = $state<WidgetType | null>(null);
	let resizing = $state<WidgetResize | null>(null);

	let grid: HTMLElement | null = null;
	let shelf: HTMLElement | null = null;
	const cells = new Map<WidgetType, HTMLElement>();
	const shelfCards = new Map<WidgetType, HTMLElement>();
	const contentRows = new Map<WidgetType, number>();

	function minimumRowsOf(type: WidgetType, width: WidgetWidth): number {
		return Math.max(contentRows.get(type) ?? 1, sizeMinimumRows(type, width));
	}

	function fits(widgets: ProfileWidget[]): boolean {
		return layoutFits(widgets.map((widget) => ({ width: widget.width, height: widget.height })));
	}

	let gesture: Gesture | null = null;
	let ghost: Ghost | null = null;
	let frame = 0;
	let stopListening: (() => void) | null = null;
	let releaseCapture: (() => void) | null = null;

	function motionMs(ms: number): number {
		return prefersReducedMotion.current ? 0 : ms;
	}

	function indexOf(type: WidgetType): number {
		return options.widgets().findIndex((widget) => widget.type === type);
	}

	function placedInGrid(type: WidgetType): boolean {
		return indexOf(type) !== -1;
	}

	function zoneBox(): Box | null {
		const viewport = options.scroll().viewport;
		if (viewport) return viewport.getBoundingClientRect();
		if (!grid) return null;
		const rect = grid.getBoundingClientRect();
		return {
			left: rect.left - zoneMargin,
			top: rect.top - zoneMargin,
			width: rect.width + zoneMargin * 2,
			height: rect.height + zoneMargin * 2
		};
	}

	function shelfContains(x: number, y: number): boolean {
		if (!shelf) return false;
		const rect = shelf.getBoundingClientRect();
		return contains(rect, x, y);
	}

	function cellBoxes(): { type: WidgetType; box: Box }[] {
		if (!grid) return [];
		const host = grid;
		return options.widgets().flatMap((widget) => {
			const cell = cells.get(widget.type);
			return cell ? [{ type: widget.type, box: layoutBox(cell, host) }] : [];
		});
	}

	function canvasCellBox(gridRect: DOMRect, row: number, column: number): Box {
		const columnWidth = (gridRect.width - gridGap) / canvasColumns;
		return {
			left: gridRect.left + (column - 1) * (columnWidth + gridGap),
			top: gridRect.top + (row - 1) * (rowHeight + gridGap),
			width: columnWidth,
			height: rowHeight
		};
	}

	function emptyTargets(widgets: ProfileWidget[]): { box: Box; insertBefore: number }[] {
		if (!grid) return [];
		const gridRect = grid.getBoundingClientRect();
		const placements = placeWidgets(
			widgets.map((widget) => ({ width: widget.width, height: widget.height })),
			canvasColumns
		);
		return emptyCells(placements).map((cell) => ({
			box: canvasCellBox(gridRect, cell.row, cell.column),
			insertBefore: cell.insertBefore
		}));
	}

	function insertionOrder(type: WidgetType, x: number, y: number): number[] {
		const others = options.widgets().filter((widget) => widget.type !== type);
		const candidates = others.map((_, index) => index).concat(others.length);
		const empty = emptyTargets(others).find((target) => contains(target.box, x, y));
		const boxes = cellBoxes().filter((entry) => entry.type !== type);
		const distanceTo = (insertBefore: number): number => {
			if (empty && empty.insertBefore === insertBefore) return -1;
			const box = boxes[insertBefore]?.box ?? boxes.at(-1)?.box;
			return box ? centerDistance(box, x, y) : 0;
		};
		return candidates.sort((a, b) => distanceTo(a) - distanceTo(b));
	}

	function reorderTarget(type: WidgetType, x: number, y: number): number | null {
		const widgets = options.widgets();
		const from = indexOf(type);
		const boxes = cellBoxes();
		for (const [index, entry] of boxes.entries()) {
			if (entry.type === type || !contains(entry.box, x, y)) continue;
			return index > from ? index + 1 : index;
		}
		const withoutSelf = widgets.filter((widget) => widget.type !== type);
		const empty = emptyTargets(withoutSelf).find((target) => contains(target.box, x, y));
		if (!empty) return null;
		return empty.insertBefore >= from ? empty.insertBefore + 1 : empty.insertBefore;
	}

	function settleAt(current: Gesture) {
		current.settledX = current.x;
		current.settledY = current.y;
	}

	function movedSinceSettle(current: Gesture): boolean {
		return Math.hypot(current.x - current.settledX, current.y - current.settledY) >= resettleDistance;
	}

	function insertFromShelf(current: Gesture): boolean {
		const created = options.create(current.type);
		for (const insertBefore of insertionOrder(current.type, current.x, current.y)) {
			const next = [...options.widgets()];
			next.splice(insertBefore, 0, created);
			if (!fits(next)) continue;
			options.update(next);
			settleAt(current);
			return true;
		}
		return false;
	}

	function withdrawFromGrid(current: Gesture) {
		options.update(options.widgets().filter((widget) => widget.type !== current.type));
	}

	function morphGhost(source: HTMLElement) {
		const current = ghost;
		if (!current) return;
		const next = cloneFace(source, source.offsetWidth, source.offsetHeight);
		const previous = [...current.inner.children];
		current.inner.appendChild(next.face);
		next.face.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: motionMs(180),
			easing: 'ease-out'
		});
		for (const face of previous) {
			const fading = face.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: motionMs(120),
				easing: 'ease-out',
				fill: 'forwards'
			});
			void fading.finished.then(
				() => face.remove(),
				() => face.remove()
			);
		}
		current.card = next.card;
		current.width = next.width;
		current.height = next.height;
		current.outer.style.width = `${next.width}px`;
		current.outer.style.height = `${next.height}px`;
	}

	async function morphIntoCell(current: Gesture) {
		await tick();
		if (gesture !== current || !placedInGrid(current.type)) return;
		const cell = cells.get(current.type);
		if (cell) morphGhost(cell);
	}

	function markRemoval(removable: boolean) {
		if (!ghost) return;
		ghost.inner.style.scale = removable ? '0.9' : '';
		ghost.inner.style.opacity = removable ? '0.6' : '';
	}

	function track(current: Gesture) {
		const { x, y } = current;
		overShelf = shelfContains(x, y);
		markRemoval(overShelf && current.origin === 'grid');
		const box = zoneBox();
		const inZone = !overShelf && box !== null && contains(box, x, y);
		const inGrid = placedInGrid(current.type);
		if (current.origin === 'shelf') {
			if (inZone && !inGrid) {
				if (insertFromShelf(current)) void morphIntoCell(current);
				return;
			}
			if (!inZone && inGrid) {
				withdrawFromGrid(current);
				morphGhost(current.source);
				return;
			}
		}
		if (!inZone || !inGrid || !movedSinceSettle(current)) {
			current.pendingTarget = null;
			return;
		}
		const insertBefore = reorderTarget(current.type, x, y);
		if (insertBefore === null) {
			current.pendingTarget = null;
			return;
		}
		if (current.pendingTarget !== insertBefore) {
			current.pendingTarget = insertBefore;
			current.pendingSince = performance.now();
			return;
		}
		if (performance.now() - current.pendingSince < reorderDwellMs) return;
		current.pendingTarget = null;
		const next = moveBefore(options.widgets(), indexOf(current.type), insertBefore);
		if (next === options.widgets() || !fits(next)) return;
		options.update(next);
		settleAt(current);
	}

	function edgeScroll(current: Gesture) {
		const { viewport, controller } = options.scroll();
		if (!viewport || !controller) return;
		const rect = viewport.getBoundingClientRect();
		if (current.x < rect.left || current.x > rect.right) return;
		let delta = 0;
		if (current.y < rect.top + edgeScrollZone) delta = -edgeScrollSpeed;
		else if (current.y > rect.bottom - edgeScrollZone) delta = edgeScrollSpeed;
		if (delta !== 0) controller.scrollTo(controller.position + delta, { instant: true });
	}

	function loop() {
		frame = 0;
		const current = gesture;
		if (!current?.started) return;
		edgeScroll(current);
		track(current);
		frame = requestAnimationFrame(loop);
	}

	function lift(current: Gesture) {
		current.started = true;
		ghost = createGhost(current.source);
		placeGhost(ghost, current.x - current.offsetX, current.y - current.offsetY);
		const timing = { duration: motionMs(liftMs), easing: quintOutCurve, fill: 'forwards' } as const;
		ghost.inner.animate([{ transform: 'scale(1)' }, { transform: `scale(${liftScale})` }], timing);
		active = current.type;
		origin = current.origin;
		document.documentElement.style.cursor = 'grabbing';
		document.documentElement.style.userSelect = 'none';
		releaseCapture = capturePointer(current.pointerId);
		frame = requestAnimationFrame(loop);
	}

	async function flyGhost(flying: Ghost, target: Box, fade: boolean): Promise<void> {
		const timing = { duration: motionMs(landMs), easing: quintOutCurve, fill: 'forwards' } as const;
		const scaleX = target.width / flying.width;
		const scaleY = target.height / flying.height;
		const flight = flying.outer.animate(
			[
				{ transform: `translate(${flying.x}px, ${flying.y}px)` },
				{
					transform: `translate(${target.left}px, ${target.top}px) scale(${scaleX}, ${scaleY})`
				}
			],
			timing
		);
		flying.inner.animate([{ transform: 'scale(1)', opacity: fade ? 0 : 1 }], timing);
		await flight.finished.catch(() => {});
	}

	async function dropIntoShelf(leaving: Ghost) {
		const animation = leaving.inner.animate([{ transform: 'scale(0.85)', opacity: 0 }], {
			duration: motionMs(200),
			easing: quintOutCurve,
			fill: 'forwards'
		});
		await animation.finished.catch(() => {});
		leaving.outer.remove();
	}

	async function flyHome(flying: Ghost, home: HTMLElement) {
		await flyGhost(flying, home.getBoundingClientRect(), true);
		flying.outer.remove();
	}

	async function landInGrid(landed: Ghost, type: WidgetType) {
		landing = type;
		await tick();
		const cell = cells.get(type);
		if (cell && grid) await flyGhost(landed, layoutBox(cell, grid), false);
		for (const animation of cells.get(type)?.getAnimations() ?? []) animation.finish();
		if (landing === type) landing = null;
		await tick();
		landed.outer.remove();
	}

	function finish(cancelled: boolean) {
		const current = gesture;
		gesture = null;
		stopListening?.();
		stopListening = null;
		cancelAnimationFrame(frame);
		frame = 0;
		document.documentElement.style.cursor = '';
		document.documentElement.style.userSelect = '';
		const carried = ghost;
		ghost = null;
		if (!current) {
			carried?.outer.remove();
			return;
		}
		if (!current.started) {
			if (!cancelled) current.onclick?.();
			return;
		}
		const removing = !cancelled && current.origin === 'grid' && overShelf;
		if (cancelled) options.update(current.initial);
		else if (removing) withdrawFromGrid(current);
		active = null;
		origin = null;
		overShelf = false;
		if (!carried) return;
		if (removing) {
			void dropIntoShelf(carried);
			return;
		}
		if (placedInGrid(current.type)) {
			void landInGrid(carried, current.type);
			return;
		}
		void flyHome(carried, shelfCards.get(current.type) ?? current.source);
	}

	function handleMove(event: PointerEvent) {
		const current = gesture;
		if (!current) return;
		current.x = event.clientX;
		current.y = event.clientY;
		if (!current.started) {
			const distance = Math.hypot(current.x - current.startX, current.y - current.startY);
			if (distance < dragThreshold) return;
			lift(current);
		}
		if (ghost) placeGhost(ghost, current.x - current.offsetX, current.y - current.offsetY);
	}

	function capturePointer(pointerId: number): () => void {
		const root = document.documentElement;
		try {
			root.setPointerCapture(pointerId);
		} catch {
			return () => {};
		}
		const offLost = on(root, 'lostpointercapture', () => finish(true));
		return () => {
			offLost();
			if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId);
		};
	}

	function listen() {
		const offMove = on(window, 'pointermove', handleMove);
		const offUp = on(window, 'pointerup', () => finish(false));
		const offCancel = on(window, 'pointercancel', () => finish(true));
		const offBlur = on(window, 'blur', () => finish(true));
		const offKey = on(
			window,
			'keydown',
			(event) => {
				if (event.key !== 'Escape' || !gesture?.started) return;
				event.preventDefault();
				event.stopPropagation();
				finish(true);
			},
			{ capture: true }
		);
		stopListening = () => {
			offMove();
			offUp();
			offCancel();
			offBlur();
			offKey();
			releaseCapture?.();
			releaseCapture = null;
		};
	}

	function start(
		event: PointerEvent,
		type: WidgetType,
		from: DragOrigin,
		source: HTMLElement,
		onclick?: () => void
	) {
		if (event.button !== 0 || gesture || resizing || options.locked()) return;
		event.preventDefault();
		const rect = source.getBoundingClientRect();
		gesture = {
			type,
			origin: from,
			source,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			x: event.clientX,
			y: event.clientY,
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top,
			started: false,
			initial: options.widgets(),
			settledX: event.clientX,
			settledY: event.clientY,
			pendingTarget: null,
			pendingSince: 0,
			onclick
		};
		listen();
	}

	function resized(type: WidgetType, width: WidgetWidth, height: number): ProfileWidget[] {
		return options
			.widgets()
			.map((widget) => (widget.type === type ? { ...widget, width, height } : widget));
	}

	function applySize(type: WidgetType, width: WidgetWidth, height: number) {
		const current = options.widgets().find((widget) => widget.type === type);
		if (!current || (current.width === width && current.height === height)) return;
		const candidates: [WidgetWidth, number][] = [
			[width, height],
			[width, current.height],
			[current.width, height]
		];
		for (const [nextWidth, nextHeight] of candidates) {
			if (nextHeight < minimumRowsOf(type, nextWidth)) continue;
			const next = resized(type, nextWidth, nextHeight);
			if (!fits(next)) continue;
			if (nextWidth !== current.width || nextHeight !== current.height) options.update(next);
			return;
		}
	}

	function startResize(event: PointerEvent, type: WidgetType, cell: HTMLElement, edge: ResizeEdge) {
		if (event.button !== 0 || gesture || resizing || options.locked() || !grid) return;
		event.preventDefault();
		event.stopPropagation();
		const host = grid;
		const startX = event.clientX;
		const startY = event.clientY;
		const startWidth = cell.offsetWidth;
		const startHeight = cell.offsetHeight;
		const anchor: ResizeEdge = edge === 'end' ? 'start' : 'end';
		const gridWidth = host.clientWidth;
		const half = (gridWidth - gridGap) / 2;
		const tallest = spanPx(canvasRows);
		resizing = {
			type,
			width: startWidth,
			height: startHeight,
			anchor,
			snapping: false,
			settling: false
		};
		document.documentElement.style.cursor = edge === 'end' ? 'nwse-resize' : 'nesw-resize';
		document.documentElement.style.userSelect = 'none';
		let pointer = { x: startX, y: startY };
		let pendingFrame = 0;
		let snappingUntil = 0;
		const follow = () => {
			pendingFrame = 0;
			const deltaX = edge === 'end' ? pointer.x - startX : startX - pointer.x;
			const pointerWidth = startWidth + deltaX;
			const pointerHeight = startHeight + pointer.y - startY;
			const previous = options.widgets().find((widget) => widget.type === type);
			const snapped = snappedWidth(Math.min(gridWidth, Math.max(half, pointerWidth)), gridWidth);
			applySize(
				type,
				snapped,
				snappedHeight(Math.min(tallest, pointerHeight), minimumRowsOf(type, snapped))
			);
			const committed = options.widgets().find((widget) => widget.type === type);
			const now = performance.now();
			if (committed?.width !== previous?.width || committed?.height !== previous?.height) {
				snappingUntil = now + motionMs(resizeSnapMs);
			}
			const width = committed?.width === 2 ? gridWidth : half;
			const height = spanPx(committed?.height ?? 1);
			resizing = {
				type,
				width: width + stretched(pointerWidth - width),
				height: height + stretched(pointerHeight - height),
				anchor,
				snapping: now < snappingUntil,
				settling: false
			};
		};
		const offMove = on(window, 'pointermove', (move: PointerEvent) => {
			pointer = { x: move.clientX, y: move.clientY };
			if (!pendingFrame) pendingFrame = requestAnimationFrame(follow);
		});
		const release = () => {
			offMove();
			offUp();
			offCancel();
			if (pendingFrame) {
				cancelAnimationFrame(pendingFrame);
				follow();
			}
			document.documentElement.style.cursor = '';
			document.documentElement.style.userSelect = '';
			const final = options.widgets().find((widget) => widget.type === type);
			const finalWidth = final?.width === 2 ? gridWidth : half;
			const finalHeight = spanPx(final?.height ?? 1);
			resizing = {
				type,
				width: finalWidth,
				height: finalHeight,
				anchor,
				snapping: false,
				settling: true
			};
			setTimeout(() => {
				if (resizing?.type === type && resizing.settling) resizing = null;
			}, motionMs(resizeSettleMs) + 20);
		};
		const offUp = on(window, 'pointerup', release);
		const offCancel = on(window, 'pointercancel', release);
	}

	function registry<K>(map: Map<K, HTMLElement>) {
		return (node: HTMLElement, key: K) => {
			map.set(key, node);
			return {
				destroy() {
					if (map.get(key) === node) map.delete(key);
				}
			};
		};
	}

	return {
		get active() {
			return active;
		},
		get origin() {
			return origin;
		},
		get overShelf() {
			return overShelf;
		},
		get landing() {
			return landing;
		},
		get resizing() {
			return resizing;
		},
		get busy() {
			return active !== null || landing !== null || resizing !== null;
		},
		start,
		startResize,
		fits,
		minimumRowsOf,
		setContentRows(type: WidgetType, rows: number) {
			contentRows.set(type, rows);
		},
		ensureMinimum(type: WidgetType): boolean {
			const widget = options.widgets().find((candidate) => candidate.type === type);
			if (!widget) return true;
			const minimum = minimumRowsOf(type, widget.width);
			if (widget.height >= minimum) return true;
			const next = resized(type, widget.width, minimum);
			if (!fits(next)) return false;
			options.update(next);
			return true;
		},
		cell: registry(cells),
		shelfCard: registry(shelfCards),
		grid(node: HTMLElement) {
			grid = node;
			return {
				destroy() {
					if (grid === node) grid = null;
				}
			};
		},
		shelf(node: HTMLElement) {
			shelf = node;
			return {
				destroy() {
					if (shelf === node) shelf = null;
				}
			};
		},
		destroy() {
			ghost?.outer.remove();
			ghost = null;
			finish(true);
		}
	};
}

export type WidgetDrag = ReturnType<typeof createWidgetDrag>;
