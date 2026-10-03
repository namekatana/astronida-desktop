import AvatarWorker from './avatar-image.worker?worker';
import type { CropArea } from './encode-webp';

export type { CropArea } from './encode-webp';
export type AvatarImages = { large: Blob; small: Blob };
export type AvatarJob = { id: number; file: Blob; area: CropArea };
export type AvatarReply = { id: number } & ({ ok: true; images: AvatarImages } | { ok: false });

let nextJobId = 0;

export function renderAvatar(file: Blob, area: CropArea): Promise<AvatarImages | null> {
	const worker = new AvatarWorker();
	const job: AvatarJob = { id: nextJobId++, file, area };
	return new Promise<AvatarImages | null>((resolve) => {
		worker.onmessage = (event: MessageEvent<AvatarReply>) => {
			const reply = event.data;
			if (reply.id !== job.id) return;
			resolve(reply.ok ? reply.images : null);
		};
		worker.onerror = () => resolve(null);
		worker.postMessage(job);
	}).finally(() => worker.terminate());
}
