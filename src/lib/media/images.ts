import type { MessageAttachment } from '$lib/messages/messages';
import { supabase } from '$lib/supabase/client';
import { mediaStore } from './media-store';

export type ImageVariant = 'feed' | 'full';

type AttachmentRef = Pick<MessageAttachment, 'id' | 'channelId'>;

const bucket = 'attachments';
const imageType = 'image/webp';
const memoryLimit = 300;
const downloadConcurrency = 4;

const urls = new Map<string, string>();
const loading = new Map<string, Promise<Blob | null>>();
let storedKeys: Set<string> | null = null;
let indexLoad: Promise<void> | null = null;
const waiting: (() => void)[] = [];
let activeDownloads = 0;

function keyOf(attachmentId: string, variant: ImageVariant): string {
	return `${attachmentId}-${variant}`;
}

function storagePath(attachment: AttachmentRef, variant: ImageVariant): string {
	return `${attachment.channelId}/${attachment.id}/${variant}.webp`;
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

async function download(attachment: AttachmentRef, variant: ImageVariant): Promise<Blob | null> {
	const { data, error } = await supabase.storage
		.from(bucket)
		.download(storagePath(attachment, variant));
	if (error || !data || data.size === 0) return null;
	return data.type === imageType ? data : new Blob([data], { type: imageType });
}

function storeOnDisk(key: string, blob: Blob) {
	void mediaStore
		.write('cache', key, blob)
		.then(() => storedKeys?.add(key))
		.catch(() => {});
}

async function fetchBlob(attachment: AttachmentRef, variant: ImageVariant): Promise<Blob | null> {
	const key = keyOf(attachment.id, variant);
	const stored = await mediaStore.read('cache', key).catch(() => null);
	if (stored) return stored;
	storedKeys?.delete(key);
	const downloaded = await withDownloadSlot(() => download(attachment, variant)).catch(() => null);
	if (downloaded) storeOnDisk(key, downloaded);
	return downloaded;
}

export function warmImageIndex() {
	indexLoad ??= mediaStore
		.keys('cache')
		.then((keys) => {
			storedKeys = new Set(keys);
		})
		.catch(() => {
			indexLoad = null;
		});
}

export function isStoredLocally(attachment: AttachmentRef, variant: ImageVariant): boolean {
	const key = keyOf(attachment.id, variant);
	return urls.has(key) || storedKeys === null || storedKeys.has(key);
}

function blobOnce(attachment: AttachmentRef, variant: ImageVariant): Promise<Blob | null> {
	const key = keyOf(attachment.id, variant);
	let pending = loading.get(key);
	if (!pending) {
		pending = fetchBlob(attachment, variant).finally(() => loading.delete(key));
		loading.set(key, pending);
	}
	return pending;
}

export function loadImageBlob(
	attachment: AttachmentRef,
	variant: ImageVariant
): Promise<Blob | null> {
	return blobOnce(attachment, variant);
}

export function cachedImage(attachment: AttachmentRef, variant: ImageVariant): string | null {
	const key = keyOf(attachment.id, variant);
	const url = urls.get(key);
	if (url) rememberUrl(key, url);
	return url ?? null;
}

export async function loadImage(
	attachment: AttachmentRef,
	variant: ImageVariant
): Promise<string | null> {
	const cached = cachedImage(attachment, variant);
	if (cached) return cached;
	const blob = await blobOnce(attachment, variant);
	if (!blob) return null;
	const raced = cachedImage(attachment, variant);
	if (raced) return raced;
	const url = URL.createObjectURL(blob);
	rememberUrl(keyOf(attachment.id, variant), url);
	await decode(url);
	return url;
}

async function decode(url: string) {
	const image = new Image();
	image.src = url;
	await image.decode().catch(() => {});
}

export function prefetchImages(attachments: AttachmentRef[] | undefined) {
	for (const attachment of attachments ?? []) {
		if (cachedImage(attachment, 'feed')) continue;
		void blobOnce(attachment, 'feed');
	}
}

export function forgetImages() {
	for (const url of urls.values()) URL.revokeObjectURL(url);
	urls.clear();
	storedKeys = null;
	indexLoad = null;
}

export function adoptSentImage(
	attachmentId: string,
	images: { feed: Blob; full: Blob; feedUrl?: string }
) {
	storeOnDisk(keyOf(attachmentId, 'feed'), images.feed);
	storeOnDisk(keyOf(attachmentId, 'full'), images.full);
	if (images.feedUrl) rememberUrl(keyOf(attachmentId, 'feed'), images.feedUrl);
}
