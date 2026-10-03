import { isAcceptedImage } from '$lib/media/compress';
import type { CropArea } from '$lib/media/encode-webp';
import type { ImageSaveResult } from './upload-image';

export interface CropSource {
	file: File;
	url: string;
	width: number;
	height: number;
}

export interface CropFrame {
	width: number;
	height: number;
	radius: number;
	rotatable: boolean;
	minimum?: { width: number; notice: string };
}

export type ImageDraft<T> =
	{ kind: 'unchanged' } | { kind: 'removed' } | { kind: 'new'; result: T; url: string };

export type ImageEditorStep = 'edit' | 'crop';

export interface ImageEditorOptions<T> {
	render: (file: File, area: CropArea) => Promise<T | null>;
	previewOf: (result: T) => Blob;
	upload: (result: T) => Promise<ImageSaveResult>;
	remove: () => Promise<ImageSaveResult>;
}

const maxSourceBytes = 50 * 1024 * 1024;

async function decodedSize(url: string): Promise<{ width: number; height: number } | null> {
	const image = new Image();
	image.src = url;
	try {
		await image.decode();
	} catch {
		return null;
	}
	if (image.naturalWidth === 0 || image.naturalHeight === 0) return null;
	return { width: image.naturalWidth, height: image.naturalHeight };
}

export function createImageEditor<T>(options: ImageEditorOptions<T>) {
	let step = $state<ImageEditorStep>('edit');
	let source = $state<CropSource | null>(null);
	let draft = $state<ImageDraft<T>>({ kind: 'unchanged' });
	let busy = $state(false);
	let error = $state<string | null>(null);

	function releaseSource() {
		if (source) URL.revokeObjectURL(source.url);
		source = null;
	}

	function replaceDraft(next: ImageDraft<T>) {
		if (draft.kind === 'new') URL.revokeObjectURL(draft.url);
		draft = next;
	}

	async function pick(file: File) {
		error = null;
		if (!isAcceptedImage(file)) {
			error = 'Этот файл не фото';
			return;
		}
		if (file.size > maxSourceBytes) {
			error = 'Фото больше 50 МБ';
			return;
		}
		const url = URL.createObjectURL(file);
		const size = await decodedSize(url);
		if (!size) {
			URL.revokeObjectURL(url);
			error = 'Не удалось открыть фото';
			return;
		}
		releaseSource();
		source = { file, url, ...size };
		step = 'crop';
	}

	function cancelCrop() {
		releaseSource();
		step = 'edit';
	}

	async function applyCrop(area: CropArea) {
		if (!source || busy) return;
		busy = true;
		const result = await options.render(source.file, area);
		busy = false;
		if (!result) {
			error = 'Не удалось обработать фото';
			return;
		}
		replaceDraft({ kind: 'new', result, url: URL.createObjectURL(options.previewOf(result)) });
		releaseSource();
		step = 'edit';
	}

	function remove() {
		error = null;
		replaceDraft({ kind: 'removed' });
	}

	async function save(): Promise<ImageSaveResult | null> {
		if (busy || draft.kind === 'unchanged') return null;
		error = null;
		busy = true;
		const result =
			draft.kind === 'new' ? await options.upload(draft.result) : await options.remove();
		busy = false;
		if (!result.ok) error = result.message;
		return result;
	}

	function reset() {
		releaseSource();
		replaceDraft({ kind: 'unchanged' });
		step = 'edit';
		error = null;
		busy = false;
	}

	return {
		get step() {
			return step;
		},
		get source() {
			return source;
		},
		get draft() {
			return draft;
		},
		get busy() {
			return busy;
		},
		get error() {
			return error;
		},
		pick,
		cancelCrop,
		applyCrop,
		remove,
		save,
		reset
	};
}

export type ImageEditor<T> = ReturnType<typeof createImageEditor<T>>;
