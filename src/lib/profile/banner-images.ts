import { mediaStore } from '$lib/media/media-store';
import { supabase } from '$lib/supabase/client';

const bucket = 'banners';
const imageType = 'image/webp';
const memoryLimit = 20;

const urls = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();
const unavailable = new Set<string>();

function keyOf(bannerId: string): string {
	return `banner-${bannerId}`;
}

function rememberUrl(key: string, url: string) {
	urls.delete(key);
	urls.set(key, url);
	while (urls.size > memoryLimit) {
		const [oldestKey, oldestUrl] = urls.entries().next().value as [string, string];
		urls.delete(oldestKey);
		URL.revokeObjectURL(oldestUrl);
	}
}

type Download = { kind: 'file'; blob: Blob } | { kind: 'denied' } | { kind: 'failed' };

async function download(userId: string, bannerId: string): Promise<Download> {
	const { data, error } = await supabase.storage
		.from(bucket)
		.download(`${userId}/${bannerId}/banner.webp`);
	if (error) return 'status' in error ? { kind: 'denied' } : { kind: 'failed' };
	if (!data || data.size === 0) return { kind: 'denied' };
	const blob = data.type === imageType ? data : new Blob([data], { type: imageType });
	return { kind: 'file', blob };
}

async function obtain(userId: string, bannerId: string, key: string): Promise<Blob | null> {
	const stored = await mediaStore.read('cache', key).catch(() => null);
	if (stored) return stored;
	const downloaded = await download(userId, bannerId).catch((): Download => ({ kind: 'failed' }));
	if (downloaded.kind === 'denied') unavailable.add(key);
	if (downloaded.kind !== 'file') return null;
	void mediaStore.write('cache', key, downloaded.blob).catch(() => {});
	return downloaded.blob;
}

async function fetchUrl(userId: string, bannerId: string): Promise<string | null> {
	const key = keyOf(bannerId);
	const blob = await obtain(userId, bannerId, key);
	if (!blob) return null;
	const raced = urls.get(key);
	if (raced) return raced;
	const url = URL.createObjectURL(blob);
	rememberUrl(key, url);
	const image = new Image();
	image.src = url;
	await image.decode().catch(() => {});
	return url;
}

export function cachedBanner(bannerId: string): string | null {
	const key = keyOf(bannerId);
	const url = urls.get(key);
	if (url) rememberUrl(key, url);
	return url ?? null;
}

export function loadBanner(userId: string, bannerId: string): Promise<string | null> {
	const cached = cachedBanner(bannerId);
	if (cached) return Promise.resolve(cached);
	const key = keyOf(bannerId);
	if (unavailable.has(key)) return Promise.resolve(null);
	let pending = loading.get(key);
	if (!pending) {
		pending = fetchUrl(userId, bannerId).finally(() => loading.delete(key));
		loading.set(key, pending);
	}
	return pending;
}

export async function preloadBanner(bannerId: string): Promise<void> {
	const key = keyOf(bannerId);
	if (urls.has(key)) return;
	const stored = await mediaStore.read('cache', key).catch(() => null);
	if (!stored || urls.has(key)) return;
	const url = URL.createObjectURL(stored);
	rememberUrl(key, url);
	const image = new Image();
	image.src = url;
	await image.decode().catch(() => {});
}

export function forgetBanners() {
	for (const url of urls.values()) URL.revokeObjectURL(url);
	urls.clear();
	loading.clear();
	unavailable.clear();
}

export function adoptBanner(bannerId: string, image: Blob) {
	const key = keyOf(bannerId);
	void mediaStore.write('cache', key, image).catch(() => {});
	if (!urls.has(key)) rememberUrl(key, URL.createObjectURL(image));
}
