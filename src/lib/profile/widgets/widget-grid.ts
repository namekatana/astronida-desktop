import type { WidgetWidth } from './widgets';

export type GridColumns = 1 | 2;

export interface WidgetSizeCells {
	width: WidgetWidth;
	height: number;
}

export interface WidgetPlacement {
	column: 1 | 2;
	row: number;
	width: WidgetWidth;
	height: number;
}

export interface EmptyCell {
	column: 1 | 2;
	row: number;
	insertBefore: number;
}

export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

export const canvasColumns = 2;
export const canvasRows = 4;
export const rowHeight = 80;
export const gridGap = 10;
export const twoColumnsMinWidth = 320;

export function columnsFor(width: number): GridColumns {
	return width >= twoColumnsMinWidth ? 2 : 1;
}

export function spanPx(rows: number): number {
	return rows * rowHeight + (rows - 1) * gridGap;
}

export function rowsFor(px: number): number {
	return Math.max(1, Math.ceil((px + gridGap) / (rowHeight + gridGap)));
}

function cellKey(row: number, column: number): string {
	return `${row}:${column}`;
}

function isFree(taken: Set<string>, row: number, column: number, size: WidgetSizeCells): boolean {
	for (let dy = 0; dy < size.height; dy++) {
		for (let dx = 0; dx < size.width; dx++) {
			if (taken.has(cellKey(row + dy, column + dx))) return false;
		}
	}
	return true;
}

function take(taken: Set<string>, placement: WidgetPlacement) {
	for (let dy = 0; dy < placement.height; dy++) {
		for (let dx = 0; dx < placement.width; dx++) {
			taken.add(cellKey(placement.row + dy, placement.column + dx));
		}
	}
}

function placeInColumn(sizes: WidgetSizeCells[]): WidgetPlacement[] {
	let row = 1;
	return sizes.map((size) => {
		const placement: WidgetPlacement = { column: 1, row, width: 2, height: size.height };
		row += size.height;
		return placement;
	});
}

export function placeWidgets(sizes: WidgetSizeCells[], columns: GridColumns): WidgetPlacement[] {
	if (columns === 1) return placeInColumn(sizes);
	const taken = new Set<string>();
	let cursorRow = 1;
	let cursorColumn = 1;
	return sizes.map((size) => {
		for (let row = cursorRow; ; row++) {
			const firstColumn = row === cursorRow ? cursorColumn : 1;
			for (let column = firstColumn; column + size.width - 1 <= canvasColumns; column++) {
				if (!isFree(taken, row, column, size)) continue;
				const placement: WidgetPlacement = {
					column: column as 1 | 2,
					row,
					width: size.width,
					height: size.height
				};
				take(taken, placement);
				cursorRow = row;
				cursorColumn = column + size.width;
				return placement;
			}
		}
	});
}

export function fitsCanvas(placements: WidgetPlacement[]): boolean {
	return placements.every((placement) => placement.row + placement.height - 1 <= canvasRows);
}

export function layoutFits(sizes: WidgetSizeCells[]): boolean {
	return fitsCanvas(placeWidgets(sizes, canvasColumns));
}

function startsBefore(placement: WidgetPlacement, row: number, column: number): boolean {
	return placement.row < row || (placement.row === row && placement.column < column);
}

export function emptyCells(placements: WidgetPlacement[]): EmptyCell[] {
	const taken = new Set<string>();
	for (const placement of placements) take(taken, placement);
	const cells: EmptyCell[] = [];
	for (let row = 1; row <= canvasRows; row++) {
		for (let column = 1; column <= canvasColumns; column++) {
			if (taken.has(cellKey(row, column))) continue;
			cells.push({
				column: column as 1 | 2,
				row,
				insertBefore: placements.filter((placement) => startsBefore(placement, row, column)).length
			});
		}
	}
	return cells;
}

export function moveBefore<T>(items: T[], from: number, insertBefore: number): T[] {
	const target = insertBefore > from ? insertBefore - 1 : insertBefore;
	if (target === from) return items;
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(target, 0, moved);
	return next;
}

export function contains(box: Box, x: number, y: number): boolean {
	return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

export function centerDistance(box: Box, x: number, y: number): number {
	return Math.hypot(box.left + box.width / 2 - x, box.top + box.height / 2 - y);
}

export function snappedWidth(liveWidth: number, gridWidth: number): WidgetWidth {
	const half = (gridWidth - gridGap) / 2;
	return liveWidth > (half + gridWidth) / 2 ? 2 : 1;
}

export function snappedHeight(liveHeight: number, minimumRows: number): number {
	const rows = Math.round((liveHeight + gridGap) / (rowHeight + gridGap));
	return Math.min(canvasRows, Math.max(minimumRows, rows));
}
