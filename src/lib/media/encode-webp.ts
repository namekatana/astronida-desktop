export async function encodeWebp(bitmap: ImageBitmap, quality: number): Promise<Blob> {
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('2d context unavailable');
	context.drawImage(bitmap, 0, 0);
	const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
	if (blob.type !== 'image/webp') throw new Error('webp encoding unavailable');
	return blob;
}

export interface CropArea {
	x: number;
	y: number;
	width: number;
	height: number;
	quarterTurns: number;
}

export function cropWithin(area: CropArea, width: number, height: number): CropArea {
	const scale = Math.min(1, width / area.width, height / area.height);
	const cropWidth = Math.max(1, Math.round(area.width * scale));
	const cropHeight = Math.max(1, Math.round(area.height * scale));
	return {
		x: Math.min(Math.max(0, Math.round(area.x)), width - cropWidth),
		y: Math.min(Math.max(0, Math.round(area.y)), height - cropHeight),
		width: cropWidth,
		height: cropHeight,
		quarterTurns: ((Math.round(area.quarterTurns) % 4) + 4) % 4
	};
}
