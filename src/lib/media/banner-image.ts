import BannerWorker from './banner-image.worker?worker';
import type { CropArea } from './encode-webp';

export type BannerJob = { id: number; file: Blob; area: CropArea };
export type BannerReply = { id: number } & ({ ok: true; image: Blob } | { ok: false });

let nextJobId = 0;

export function renderBanner(file: Blob, area: CropArea): Promise<Blob | null> {
	const worker = new BannerWorker();
	const job: BannerJob = { id: nextJobId++, file, area };
	return new Promise<Blob | null>((resolve) => {
		worker.onmessage = (event: MessageEvent<BannerReply>) => {
			const reply = event.data;
			if (reply.id !== job.id) return;
			resolve(reply.ok ? reply.image : null);
		};
		worker.onerror = () => resolve(null);
		worker.postMessage(job);
	}).finally(() => worker.terminate());
}
