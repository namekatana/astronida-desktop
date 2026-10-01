import { thumbHashToRgba } from './thumbhash';

const cacheLimit = 500;
const images = new Map<string, string | null>();

function decodeBase64(text: string): Uint8Array | null {
	try {
		return Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
	} catch {
		return null;
	}
}

function render(base64: string): string | null {
	const hash = decodeBase64(base64);
	if (!hash || hash.length < 5) return null;
	const { width, height, rgba } = thumbHashToRgba(hash);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) return null;
	context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
	return canvas.toDataURL();
}

export function thumbHashImage(base64: string): string | null {
	if (images.has(base64)) return images.get(base64) ?? null;
	const image = render(base64);
	images.set(base64, image);
	if (images.size > cacheLimit) images.delete(images.keys().next().value as string);
	return image;
}
