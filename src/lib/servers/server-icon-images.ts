import { onAccountReset } from '$lib/auth/account-reset';
import type { AvatarImages } from '$lib/media/avatar-image';
import { mediaStore } from '$lib/media/media-store';
import { supabase } from '$lib/supabase/client';

export type ServerIconVariant = keyof AvatarImages;

const bucket = 'server-icons';
const imageType = 'image/webp';
const memoryLimit = 100;
const downloadConcurrency = 4;

const urls = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();
const unavailable = new Set<string>();
const waiting: (() => void)[] = [];
let activeDownloads = 0;

async function withDownloadSlot<T>(task: () => Promise<T>): Promise<T> {
	if (activeDownloads >= downloadConcurrency) {
		await new Promise<void>((resolve) => waiting.push(resolve));
	}
	activeDownloads += 1;
	try {
		return await task();
	} finally {
		activeDownloads -= 1;
		waiting.shift()?.();
	}
}

function keyOf(iconId: string, variant: ServerIconVariant): string {
	return `server-icon-${iconId}-${variant}`;
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

async function download(
	serverId: string,
	iconId: string,
	variant: ServerIconVariant
): Promise<Download> {
	const { data, error } = await supabase.storage
		.from(bucket)
		.download(`${serverId}/${iconId}/${variant}.webp`);
	if (error) return 'status' in error ? { kind: 'denied' } : { kind: 'failed' };
	if (!data || data.size === 0) return { kind: 'denied' };
	const blob = data.type === imageType ? data : new Blob([data], { type: imageType });
	return { kind: 'file', blob };
}

async function obtain(serverId: string, iconId: string, variant: ServerIconVariant, key: string) {
	const stored = await mediaStore.read('cache', key).catch(() => null);
	if (stored) return stored;
	const downloaded = await withDownloadSlot(() => download(serverId, iconId, variant)).catch(
		(): Download => ({ kind: 'failed' })
	);
	if (downloaded.kind === 'denied') unavailable.add(key);
	if (downloaded.kind !== 'file') return null;
	void mediaStore.write('cache', key, downloaded.blob).catch(() => {});
	return downloaded.blob;
}

async function remember(key: string, blob: Blob): Promise<string> {
	const url = URL.createObjectURL(blob);
	rememberUrl(key, url);
	const image = new Image();
	image.src = url;
	await image.decode().catch(() => {});
	return url;
}

async function fetchUrl(
	serverId: string,
	iconId: string,
	variant: ServerIconVariant
): Promise<string | null> {
	const key = keyOf(iconId, variant);
	const blob = await obtain(serverId, iconId, variant, key);
	if (!blob) return null;
	return urls.get(key) ?? remember(key, blob);
}

export function cachedServerIcon(iconId: string, variant: ServerIconVariant): string | null {
	const key = keyOf(iconId, variant);
	const url = urls.get(key);
	if (url) rememberUrl(key, url);
	return url ?? null;
}

export function loadServerIcon(
	serverId: string,
	iconId: string,
	variant: ServerIconVariant
): Promise<string | null> {
	const cached = cachedServerIcon(iconId, variant);
	if (cached) return Promise.resolve(cached);
	const key = keyOf(iconId, variant);
	if (unavailable.has(key)) return Promise.resolve(null);
	let pending = loading.get(key);
	if (!pending) {
		pending = fetchUrl(serverId, iconId, variant).finally(() => loading.delete(key));
		loading.set(key, pending);
	}
	return pending;
}

export function adoptServerIcon(iconId: string, images: AvatarImages) {
	for (const variant of ['large', 'small'] as const) {
		const key = keyOf(iconId, variant);
		void mediaStore.write('cache', key, images[variant]).catch(() => {});
		if (!urls.has(key)) rememberUrl(key, URL.createObjectURL(images[variant]));
	}
}

onAccountReset(() => {
	for (const url of urls.values()) URL.revokeObjectURL(url);
	urls.clear();
	loading.clear();
	unavailable.clear();
});
