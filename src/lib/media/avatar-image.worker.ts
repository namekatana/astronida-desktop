import type { AvatarImages, AvatarJob, AvatarReply } from './avatar-image';
import { cropWithin, encodeWebp, type CropArea } from './encode-webp';

const avatarSides = { large: 512, small: 128 };
const largeQuality = 0.86;
const smallQuality = 0.82;

const scope = self as unknown as {
	onmessage: ((event: MessageEvent<AvatarJob>) => void) | null;
	postMessage(reply: AvatarReply): void;
};

scope.onmessage = (event) => {
	const { id, file, area } = event.data;
	render(file, area).then(
		(images) => scope.postMessage({ id, ok: true, images }),
		() => scope.postMessage({ id, ok: false })
	);
};

async function render(file: Blob, area: CropArea): Promise<AvatarImages> {
	const bitmaps: ImageBitmap[] = [];
	try {
		const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
		bitmaps.push(source);
		const side = Math.min(area.width, area.height);
		const crop = cropWithin({ ...area, width: side, height: side }, source.width, source.height);
		const cropped = await createImageBitmap(source, crop.x, crop.y, crop.width, crop.height, {
			resizeWidth: avatarSides.large,
			resizeHeight: avatarSides.large,
			resizeQuality: 'high'
		});
		bitmaps.push(cropped);
		const large = await rotated(cropped, crop.quarterTurns);
		if (large !== cropped) bitmaps.push(large);
		const small = await createImageBitmap(large, {
			resizeWidth: avatarSides.small,
			resizeHeight: avatarSides.small,
			resizeQuality: 'high'
		});
		bitmaps.push(small);
		return {
			large: await encodeWebp(large, largeQuality),
			small: await encodeWebp(small, smallQuality)
		};
	} finally {
		for (const bitmap of bitmaps) bitmap.close();
	}
}

async function rotated(bitmap: ImageBitmap, quarterTurns: number): Promise<ImageBitmap> {
	if (quarterTurns === 0) return bitmap;
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('2d context unavailable');
	context.translate(bitmap.width / 2, bitmap.height / 2);
	context.rotate((-quarterTurns * Math.PI) / 2);
	context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
	return createImageBitmap(canvas);
}
