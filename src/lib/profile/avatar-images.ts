import type { AvatarImages } from '$lib/media/avatar-image';
import { mediaStore } from '$lib/media/media-store';
import { supabase } from '$lib/supabase/client';

export type AvatarVariant = keyof AvatarImages;

const bucket = 'avatars';
const imageType = 'image/webp';
const memoryLimit = 200;
const downloadConcurrency = 6;

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

function keyOf(avatarId: string, variant: AvatarVariant): string {
	return `avatar-${avatarId}-${variant}`;
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
	userId: string,
	avatarId: string,
	variant: AvatarVariant
): Promise<Download> {
	const { data, error } = await supabase.storage
		.from(bucket)
		.download(`${userId}/${avatarId}/${variant}.webp`);
	if (error) return 'status' in error ? { kind: 'denied' } : { kind: 'failed' };
	if (!data || data.size === 0) return { kind: 'denied' };
	const blob = data.type === imageType ? data : new Blob([data], { type: imageType });
	return { kind: 'file', blob };
}

async function obtain(userId: string, avatarId: string, variant: AvatarVariant, key: string) {
	const stored = await mediaStore.read('cache', key).catch(() => null);
	if (stored) return stored;
	const downloaded = await withDownloadSlot(() => download(userId, avatarId, variant)).catch(
		(): Download => ({ kind: 'failed' })
	);
	if (downloaded.kind === 'denied') unavailable.add(key);
	if (downloaded.kind !== 'file') return null;
	void mediaStore.write('cache', key, downloaded.blob).catch(() => {});
	return downloaded.blob;
}

async function fetchUrl(
	userId: string,
	avatarId: string,
	variant: AvatarVariant
): Promise<string | null> {
	const key = keyOf(avatarId, variant);
	const blob = await obtain(userId, avatarId, variant, key);
	if (!blob) return null;
	const raced = urls.get(key);
	if (raced) return raced;
	return remember(key, blob);
}

async function remember(key: string, blob: Blob): Promise<string> {
	const url = URL.createObjectURL(blob);
	rememberUrl(key, url);
	const image = new Image();
	image.src = url;
	await image.decode().catch(() => {});
	return url;
}

export async function preloadAvatars(
	entries: { avatarId: string; variant: AvatarVariant }[]
): Promise<void> {
	const keys = new Set(entries.map(({ avatarId, variant }) => keyOf(avatarId, variant)));
	await Promise.all(
		[...keys].map(async (key) => {
			if (urls.has(key)) return;
			const stored = await mediaStore.read('cache', key).catch(() => null);
			if (stored && !urls.has(key)) await remember(key, stored);
		})
	);
}

export function cachedAvatar(avatarId: string, variant: AvatarVariant): string | null {
	const key = keyOf(avatarId, variant);
	const url = urls.get(key);
	if (url) rememberUrl(key, url);
	return url ?? null;
}

export function loadAvatar(
	userId: string,
	avatarId: string,
	variant: AvatarVariant
): Promise<string | null> {
	const cached = cachedAvatar(avatarId, variant);
	if (cached) return Promise.resolve(cached);
	const key = keyOf(avatarId, variant);
	if (unavailable.has(key)) return Promise.resolve(null);
	let pending = loading.get(key);
	if (!pending) {
		pending = fetchUrl(userId, avatarId, variant).finally(() => loading.delete(key));
		loading.set(key, pending);
	}
	return pending;
}

export function forgetAvatars() {
	for (const url of urls.values()) URL.revokeObjectURL(url);
	urls.clear();
	loading.clear();
	unavailable.clear();
}

export function adoptAvatar(avatarId: string, images: AvatarImages) {
	for (const variant of ['large', 'small'] as const) {
		const key = keyOf(avatarId, variant);
		void mediaStore.write('cache', key, images[variant]).catch(() => {});
		if (!urls.has(key)) rememberUrl(key, URL.createObjectURL(images[variant]));
	}
}
