import type { MessageAttachment } from '$lib/messages/messages';

type Sized = Pick<MessageAttachment, 'width' | 'height'>;

export type AlbumTile<T extends Sized = MessageAttachment> = {
	attachment: T;
	index: number;
	aspect: number;
};
export type AlbumRow<T extends Sized = MessageAttachment> = {
	height: number;
	tiles: AlbumTile<T>[];
};

export const albumWidth = 400;
const singleMaxHeight = 360;
const singleMinSide = 200;
const rowMinHeight = 96;
const rowMaxHeight = 280;
const tileGap = 2;
const minAspect = 0.5;
const maxAspect = 2.5;

const rowSplits: Record<number, number[]> = {
	2: [2],
	3: [1, 2],
	4: [2, 2],
	5: [2, 3],
	6: [3, 3],
	7: [1, 3, 3],
	8: [2, 3, 3],
	9: [3, 3, 3],
	10: [1, 3, 3, 3]
};

function aspectOf(attachment: Sized): number {
	return Math.min(maxAspect, Math.max(minAspect, attachment.width / attachment.height));
}

export function singleSize(
	attachment: Sized,
	maxWidth = albumWidth
): { width: number; height: number } {
	const { width, height } = attachment;
	const scale = Math.min(
		maxWidth / width,
		singleMaxHeight / height,
		Math.max(1, singleMinSide / Math.max(width, height))
	);
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function albumRows<T extends Sized>(attachments: T[], width = albumWidth): AlbumRow<T>[] {
	const split = rowSplits[attachments.length] ?? [attachments.length];
	const rows: AlbumRow<T>[] = [];
	let offset = 0;
	for (const count of split) {
		const tiles = attachments.slice(offset, offset + count).map((attachment, position) => ({
			attachment,
			index: offset + position,
			aspect: aspectOf(attachment)
		}));
		offset += count;
		const totalAspect = tiles.reduce((sum, tile) => sum + tile.aspect, 0);
		const fitted = (width - tileGap * (tiles.length - 1)) / totalAspect;
		rows.push({
			height: Math.round(Math.min(rowMaxHeight, Math.max(rowMinHeight, fitted))),
			tiles
		});
	}
	return rows;
}
