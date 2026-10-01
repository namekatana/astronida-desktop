import type { CompressedImage, CompressJob, CompressReply } from './compress';
import {
	feedMaxSide,
	fitWithin,
	highQualityMaxSide,
	standardMaxSide,
	type ImageSize
} from './image-size';
import { thumbHashFromRgba, thumbHashMaxSide } from './thumbhash';

const fullQuality = 0.82;
const feedQuality = 0.8;

const scope = self as unknown as {
	onmessage: ((event: MessageEvent<CompressJob>) => void) | null;
	postMessage(reply: CompressReply): void;
};

scope.onmessage = (event) => {
	const { id, file, highQuality } = event.data;
	compress(file, highQuality).then(
		(image) => scope.postMessage({ id, ok: true, image }),
		() => scope.postMessage({ id, ok: false, reason: 'unsupported' })
	);
};

async function compress(file: Blob, highQuality: boolean): Promise<CompressedImage> {
	const bitmaps = new Set<ImageBitmap>();
	const track = (bitmap: ImageBitmap) => {
		bitmaps.add(bitmap);
		return bitmap;
	};

	try {
		const source = track(await createImageBitmap(file, { imageOrientation: 'from-image' }));
		const maxSide = highQuality ? highQualityMaxSide : standardMaxSide;
		const fullSize = fitWithin(source.width, source.height, maxSide);
		const full = track(await resized(source, fullSize));
		if (full !== source) source.close();

		const feed = track(
			await resized(full, fitWithin(fullSize.width, fullSize.height, feedMaxSide))
		);
		const thumbHash = thumbHashOf(feed);
		const feedBlob = await encodeWebp(feed, feedQuality);
		if (feed !== full) feed.close();
		const fullBlob = await encodeWebp(full, fullQuality);

		return { ...fullSize, thumbHash, feed: feedBlob, full: fullBlob };
	} finally {
		for (const bitmap of bitmaps) bitmap.close();
	}
}

function resized(bitmap: ImageBitmap, size: ImageSize): Promise<ImageBitmap> {
	if (bitmap.width === size.width && bitmap.height === size.height) return Promise.resolve(bitmap);
	return createImageBitmap(bitmap, {
		resizeWidth: size.width,
		resizeHeight: size.height,
		resizeQuality: 'high'
	});
}

async function encodeWebp(bitmap: ImageBitmap, quality: number): Promise<Blob> {
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('2d context unavailable');
	context.drawImage(bitmap, 0, 0);
	const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
	if (blob.type !== 'image/webp') throw new Error('webp encoding unavailable');
	return blob;
}

function thumbHashOf(bitmap: ImageBitmap): string {
	const size = fitWithin(bitmap.width, bitmap.height, thumbHashMaxSide);
	const canvas = new OffscreenCanvas(size.width, size.height);
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('2d context unavailable');
	context.drawImage(bitmap, 0, 0, size.width, size.height);
	const pixels = context.getImageData(0, 0, size.width, size.height).data;
	return toBase64(thumbHashFromRgba(size.width, size.height, pixels));
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}
