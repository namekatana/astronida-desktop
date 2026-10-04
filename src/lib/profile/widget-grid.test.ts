import { describe, expect, it } from 'vitest';
import {
	emptyCells,
	fitsCanvas,
	layoutFits,
	moveBefore,
	placeWidgets,
	rowsFor,
	snappedHeight,
	snappedWidth,
	spanPx
} from './widget-grid';

const at = (placements: ReturnType<typeof placeWidgets>) =>
	placements.map((placement) => `${placement.column},${placement.row} ${placement.width}x${placement.height}`);

describe('placeWidgets', () => {
	it('flows half widgets left to right, row by row', () => {
		const placements = placeWidgets(
			[
				{ width: 1, height: 1 },
				{ width: 1, height: 1 },
				{ width: 1, height: 1 }
			],
			2
		);
		expect(at(placements)).toEqual(['1,1 1x1', '2,1 1x1', '1,2 1x1']);
	});

	it('stacks short widgets next to a tall one', () => {
		const placements = placeWidgets(
			[
				{ width: 1, height: 2 },
				{ width: 1, height: 1 },
				{ width: 1, height: 1 }
			],
			2
		);
		expect(at(placements)).toEqual(['1,1 1x2', '2,1 1x1', '2,2 1x1']);
	});

	it('leaves a hole before a full width widget instead of reordering', () => {
		const placements = placeWidgets(
			[
				{ width: 1, height: 1 },
				{ width: 2, height: 1 }
			],
			2
		);
		expect(at(placements)).toEqual(['1,1 1x1', '1,2 2x1']);
		expect(emptyCells(placements)).toEqual([
			{ column: 2, row: 1, insertBefore: 1 },
			{ column: 1, row: 3, insertBefore: 2 },
			{ column: 2, row: 3, insertBefore: 2 },
			{ column: 1, row: 4, insertBefore: 2 },
			{ column: 2, row: 4, insertBefore: 2 }
		]);
	});

	it('never moves backwards past the cursor', () => {
		const placements = placeWidgets(
			[
				{ width: 1, height: 3 },
				{ width: 2, height: 1 },
				{ width: 1, height: 1 }
			],
			2
		);
		expect(at(placements)).toEqual(['1,1 1x3', '1,4 2x1', '1,5 1x1']);
	});

	it('puts every widget on its own full row in one column', () => {
		const placements = placeWidgets(
			[
				{ width: 1, height: 2 },
				{ width: 1, height: 1 }
			],
			1
		);
		expect(at(placements)).toEqual(['1,1 2x2', '1,3 2x1']);
	});
});

describe('canvas limits', () => {
	it('accepts exactly the two by four canvas', () => {
		expect(
			layoutFits([
				{ width: 2, height: 2 },
				{ width: 1, height: 2 },
				{ width: 1, height: 2 }
			])
		).toBe(true);
	});

	it('rejects a layout that spills below the fourth row', () => {
		expect(
			layoutFits([
				{ width: 2, height: 3 },
				{ width: 2, height: 2 }
			])
		).toBe(false);
	});

	it('counts holes left by the flow as used space', () => {
		expect(
			fitsCanvas(
				placeWidgets(
					[
						{ width: 1, height: 3 },
						{ width: 2, height: 1 },
						{ width: 1, height: 1 }
					],
					2
				)
			)
		).toBe(false);
	});
});

describe('sizes', () => {
	it('converts between rows and pixels', () => {
		expect(spanPx(1)).toBe(80);
		expect(spanPx(2)).toBe(170);
		expect(rowsFor(78)).toBe(1);
		expect(rowsFor(81)).toBe(2);
		expect(rowsFor(170)).toBe(2);
		expect(rowsFor(171)).toBe(3);
	});

	it('snaps the height to rows within the minimum and the canvas', () => {
		expect(snappedHeight(120, 1)).toBe(1);
		expect(snappedHeight(130, 1)).toBe(2);
		expect(snappedHeight(40, 2)).toBe(2);
		expect(snappedHeight(900, 1)).toBe(4);
	});

	it('snaps the width at the middle between half and full', () => {
		expect(snappedWidth(250, 408)).toBe(1);
		expect(snappedWidth(320, 408)).toBe(2);
	});

	it('moves an item before another index', () => {
		expect(moveBefore(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'a', 'c']);
		expect(moveBefore(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
	});
});
