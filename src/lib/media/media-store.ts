import { invoke } from '@tauri-apps/api/core';

export type MediaBucket = 'cache' | 'outbox';

interface MediaBackend {
	read(bucket: MediaBucket, key: string): Promise<Blob | null>;
	write(bucket: MediaBucket, key: string, blob: Blob): Promise<void>;
	keys(bucket: MediaBucket): Promise<string[]>;
	remove(bucket: MediaBucket, prefix: string): Promise<void>;
}

const imageType = 'image/webp';

const tauriBackend: MediaBackend = {
	async read(bucket, key) {
		const bytes = await invoke<ArrayBuffer>('media_read', { bucket, key });
		return bytes.byteLength > 0 ? new Blob([bytes], { type: imageType }) : null;
	},

	async write(bucket, key, blob) {
		const bytes = new Uint8Array(await blob.arrayBuffer());
		await invoke('media_write', bytes, {
			headers: { 'x-media-bucket': bucket, 'x-media-key': key }
		});
	},

	keys(bucket) {
		return invoke<string[]>('media_keys', { bucket });
	},

	remove(bucket, prefix) {
		return invoke('media_delete', { bucket, prefix });
	}
};

function createMemoryBackend(): MediaBackend {
	const files = new Map<string, Blob>();
	const pathOf = (bucket: MediaBucket, key: string) => `${bucket}/${key}`;

	return {
		async read(bucket, key) {
			return files.get(pathOf(bucket, key)) ?? null;
		},

		async write(bucket, key, blob) {
			files.set(pathOf(bucket, key), blob);
		},

		async keys(bucket) {
			const prefix = pathOf(bucket, '');
			return [...files.keys()]
				.filter((path) => path.startsWith(prefix))
				.map((path) => path.slice(prefix.length));
		},

		async remove(bucket, prefix) {
			for (const path of files.keys()) {
				if (path.startsWith(pathOf(bucket, prefix))) files.delete(path);
			}
		}
	};
}

function isTauri() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const mediaStore: MediaBackend = isTauri() ? tauriBackend : createMemoryBackend();
