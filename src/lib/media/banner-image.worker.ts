import type { BannerJob, BannerReply } from './banner-image';
import { bannerSize } from './banner-size';
import { cropWithin, encodeWebp, type CropArea } from './encode-webp';

const bannerQuality = 0.8;

const scope = self as unknown as {
	onmessage: ((event: MessageEvent<BannerJob>) => void) | null;
	postMessage(reply: BannerReply): void;
};

scope.onmessage = (event) => {
	const { id, file, area } = event.data;
	render(file, area).then(
		(image) => scope.postMessage({ id, ok: true, image }),
		() => scope.postMessage({ id, ok: false })
	);
};

async function render(file: Blob, area: CropArea): Promise<Blob> {
	const bitmaps: ImageBitmap[] = [];
	try {
		const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
		bitmaps.push(source);
		const crop = cropWithin(area, source.width, source.height);
		const banner = await createImageBitmap(source, crop.x, crop.y, crop.width, crop.height, {
			resizeWidth: bannerSize.width,
			resizeHeight: bannerSize.height,
			resizeQuality: 'high'
		});
		bitmaps.push(banner);
		return await encodeWebp(banner, bannerQuality);
	} finally {
		for (const bitmap of bitmaps) bitmap.close();
	}
}
