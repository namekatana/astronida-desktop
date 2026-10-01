import CompressWorker from './compress.worker?worker';

export type CompressedImage = {
	width: number;
	height: number;
	thumbHash: string;
	feed: Blob;
	full: Blob;
};
export type CompressFailure = 'unsupported' | 'too_large';
export type CompressResult =
	{ ok: true; image: CompressedImage } | { ok: false; reason: CompressFailure };
export type CompressJob = { id: number; file: Blob; highQuality: boolean };
export type CompressReply = { id: number } & CompressResult;

const acceptedTypes = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/bmp',
	'image/avif'
]);
const maxSourceBytes = 50 * 1024 * 1024;

let worker: Worker | null = null;
let queuedJobs = 0;
let nextJobId = 0;
let queue: Promise<unknown> = Promise.resolve();

export function isAcceptedImage(file: Blob): boolean {
	return acceptedTypes.has(file.type);
}

export function compressImage(
	file: Blob,
	options: { highQuality: boolean }
): Promise<CompressResult> {
	const rejection = rejectionOf(file);
	if (rejection) return Promise.resolve({ ok: false, reason: rejection });

	queuedJobs += 1;
	const job = queue.then(() =>
		compressIn(acquireWorker(), { id: nextJobId++, file, highQuality: options.highQuality })
	);
	queue = job;
	return job.finally(releaseWorker);
}

function rejectionOf(file: Blob): CompressFailure | null {
	if (!isAcceptedImage(file)) return 'unsupported';
	if (file.size > maxSourceBytes) return 'too_large';
	return null;
}

function acquireWorker(): Worker {
	worker ??= new CompressWorker();
	return worker;
}

function releaseWorker() {
	queuedJobs -= 1;
	if (queuedJobs > 0) return;
	worker?.terminate();
	worker = null;
}

function compressIn(target: Worker, job: CompressJob): Promise<CompressResult> {
	return new Promise((resolve) => {
		const finish = (result: CompressResult) => {
			target.removeEventListener('message', onMessage);
			target.removeEventListener('error', onError);
			resolve(result);
		};
		const onMessage = (event: MessageEvent<CompressReply>) => {
			const reply = event.data;
			if (reply.id !== job.id) return;
			finish(reply.ok ? { ok: true, image: reply.image } : { ok: false, reason: reply.reason });
		};
		const onError = () => finish({ ok: false, reason: 'unsupported' });

		target.addEventListener('message', onMessage);
		target.addEventListener('error', onError);
		target.postMessage(job);
	});
}
