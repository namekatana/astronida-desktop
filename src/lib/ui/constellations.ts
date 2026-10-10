type StarSize = 'faint' | 'normal' | 'bright';

interface SketchStar {
	x: number;
	y: number;
	size?: StarSize;
}

interface Sketch {
	stars: SketchStar[];
	links: [number, number][];
}

export interface ConstellationStar {
	x: number;
	y: number;
	scale: number;
	hidden: boolean;
}

export interface Constellation {
	stars: ConstellationStar[];
	links: [number, number][];
}

const scaleBySize: Record<StarSize, number> = { faint: 0.75, normal: 1, bright: 1.25 };

const orion: Sketch = {
	stars: [
		{ x: 44, y: 16, size: 'faint' },
		{ x: 54, y: 40, size: 'faint' },
		{ x: 63, y: 8, size: 'faint' },
		{ x: 68, y: 36, size: 'faint' },
		{ x: 79, y: 58 },
		{ x: 98, y: 67, size: 'bright' },
		{ x: 121, y: 46 },
		{ x: 140, y: 60 },
		{ x: 139, y: 112 },
		{ x: 143, y: 107 },
		{ x: 148, y: 103 },
		{ x: 150, y: 152 },
		{ x: 195, y: 129, size: 'bright' },
		{ x: 156, y: 122, size: 'faint' },
		{ x: 158, y: 127, size: 'faint' },
		{ x: 161, y: 131, size: 'faint' },
		{ x: 156, y: 21, size: 'faint' },
		{ x: 165, y: 25, size: 'faint' },
		{ x: 177, y: 35 },
		{ x: 182, y: 42, size: 'faint' },
		{ x: 190, y: 59, size: 'faint' },
		{ x: 189, y: 67, size: 'faint' }
	],
	links: [
		[0, 1],
		[1, 4],
		[2, 3],
		[3, 4],
		[4, 5],
		[5, 6],
		[6, 7],
		[5, 8],
		[7, 10],
		[8, 9],
		[9, 10],
		[8, 11],
		[10, 12],
		[11, 12],
		[7, 18],
		[16, 17],
		[17, 18],
		[18, 19],
		[19, 20],
		[20, 21]
	]
};

const bigDipper: Sketch = {
	stars: [
		{ x: 30, y: 62 },
		{ x: 63, y: 52 },
		{ x: 92, y: 59 },
		{ x: 120, y: 73 },
		{ x: 129, y: 110 },
		{ x: 180, y: 112 },
		{ x: 187, y: 71 }
	],
	links: [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 4],
		[4, 5],
		[5, 6],
		[6, 3]
	]
};

const littleDipper: Sketch = {
	stars: [
		{ x: 60, y: 34 },
		{ x: 79, y: 57 },
		{ x: 102, y: 73 },
		{ x: 129, y: 78 },
		{ x: 138, y: 105 },
		{ x: 171, y: 112 },
		{ x: 164, y: 82 }
	],
	links: [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 4],
		[4, 5],
		[5, 6],
		[6, 3]
	]
};

const cassiopeia: Sketch = {
	stars: [
		{ x: 40, y: 59 },
		{ x: 79, y: 103 },
		{ x: 118, y: 71 },
		{ x: 157, y: 108 },
		{ x: 198, y: 55 }
	],
	links: [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 4]
	]
};

const cygnus: Sketch = {
	stars: [
		{ x: 134, y: 27 },
		{ x: 122, y: 71 },
		{ x: 115, y: 101 },
		{ x: 106, y: 133 },
		{ x: 81, y: 59 },
		{ x: 171, y: 85 },
		{ x: 46, y: 46 }
	],
	links: [
		[0, 1],
		[1, 2],
		[2, 3],
		[1, 4],
		[4, 6],
		[1, 5]
	]
};

function distance(a: SketchStar, b: SketchStar): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestIndex(stars: SketchStar[], target: SketchStar, skip: Set<number>): number {
	let best = -1;
	stars.forEach((star, index) => {
		if (skip.has(index)) return;
		if (best === -1 || distance(star, target) < distance(stars[best], target)) best = index;
	});
	return best;
}

function arrange(sketch: Sketch, slots: SketchStar[]): Constellation {
	const taken = new Set<number>();
	const slotOfStar = sketch.stars.map((star) => {
		const slot = nearestIndex(slots, star, taken);
		taken.add(slot);
		return slot;
	});

	const stars = slots.map((slot, slotIndex): ConstellationStar => {
		const ownIndex = slotOfStar.indexOf(slotIndex);
		if (ownIndex !== -1) {
			const own = sketch.stars[ownIndex];
			return { x: own.x, y: own.y, scale: scaleBySize[own.size ?? 'normal'], hidden: false };
		}
		const host = sketch.stars[nearestIndex(sketch.stars, slot, new Set())];
		return { x: host.x, y: host.y, scale: 0, hidden: true };
	});

	const links = sketch.links.map(([from, to]): [number, number] => [
		slotOfStar[from],
		slotOfStar[to]
	]);

	return { stars, links };
}

const sketches = { bigDipper, littleDipper, cassiopeia, orion, cygnus };

export type ConstellationName = keyof typeof sketches;

export const constellations: Constellation[] = Object.values(sketches).map((sketch) =>
	arrange(sketch, orion.stars)
);

export function constellationNamed(name: ConstellationName): Constellation {
	const sketch = sketches[name];
	return arrange(sketch, sketch.stars);
}
