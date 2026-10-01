import { PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { postApi } from '$lib/realtime/api-request';
import { asRecord } from '$lib/ui/record';
import type { CompressedImage } from './compress';

export type UploadResult = { ok: true; ids: string[] } | { ok: false; retry: boolean };

type UploadTarget = { id: string; feedUrl: string; fullUrl: string };
type UploadFile = { url: string; blob: Blob };

const uploadConcurrency = 3;
const uploadTimeoutMs = 120_000;

function targetsFrom(body: unknown, expected: number): UploadTarget[] | null {
	const list = asRecord(body)?.attachments;
	if (!Array.isArray(list) || list.length !== expected) return null;
	const targets: UploadTarget[] = [];
	for (const item of list) {
		const record = asRecord(item);
		const id = record?.id;
		const feedUrl = record?.feed_upload_url;
		const fullUrl = record?.full_upload_url;
		if (typeof id !== 'string' || typeof feedUrl !== 'string' || typeof fullUrl !== 'string') {
			return null;
		}
		targets.push({ id, feedUrl, fullUrl });
	}
	return targets;
}

function putFile(file: UploadFile, onProgress: (bytes: number) => void): Promise<boolean> {
	return new Promise((resolve) => {
		const request = new XMLHttpRequest();
		request.open('PUT', file.url);
		request.timeout = uploadTimeoutMs;
		request.setRequestHeader('Content-Type', file.blob.type);
		request.setRequestHeader('Cache-Control', 'max-age=31536000');
		request.setRequestHeader('x-upsert', 'false');
		request.setRequestHeader('apikey', PUBLIC_SUPABASE_PUBLISHABLE_KEY);
		request.upload.onprogress = (event) => onProgress(event.loaded);
		request.onload = () => {
			const ok = request.status >= 200 && request.status < 300;
			if (ok) onProgress(file.blob.size);
			resolve(ok);
		};
		request.onerror = () => resolve(false);
		request.ontimeout = () => resolve(false);
		request.onabort = () => resolve(false);
		request.send(file.blob);
	});
}

async function putAll(
	files: UploadFile[],
	onProgress: (fraction: number) => void
): Promise<boolean> {
	const total = files.reduce((sum, file) => sum + file.blob.size, 0) || 1;
	const sent = files.map(() => 0);
	const report = () => onProgress(sent.reduce((sum, bytes) => sum + bytes, 0) / total);
	const pending = files.map((file, index) => ({ file, index }));
	let allSent = true;

	const worker = async () => {
		for (let next = pending.shift(); next && allSent; next = pending.shift()) {
			const { file, index } = next;
			const ok = await putFile(file, (bytes) => {
				sent[index] = bytes;
				report();
			});
			if (!ok) allSent = false;
		}
	};
	await Promise.all(Array.from({ length: Math.min(uploadConcurrency, files.length) }, worker));
	return allSent;
}

export async function uploadImages(
	channelId: string,
	images: CompressedImage[],
	spoiler: boolean,
	onProgress: (fraction: number) => void
): Promise<UploadResult> {
	const response = await postApi(`/channels/${channelId}/attachments`, {
		images: images.map((image) => ({
			width: image.width,
			height: image.height,
			thumbhash: image.thumbHash,
			spoiler
		}))
	});
	if (!response) return { ok: false, retry: true };
	if (response.status !== 201) {
		return { ok: false, retry: response.status === 429 || response.status >= 500 };
	}
	const targets = targetsFrom(response.body, images.length);
	if (!targets) return { ok: false, retry: false };

	const files = images.flatMap((image, index) => [
		{ url: targets[index].feedUrl, blob: image.feed },
		{ url: targets[index].fullUrl, blob: image.full }
	]);
	onProgress(0);
	const uploaded = await putAll(files, onProgress);
	return uploaded
		? { ok: true, ids: targets.map((target) => target.id) }
		: { ok: false, retry: true };
}
