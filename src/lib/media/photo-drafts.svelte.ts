import { attachmentMaxCount } from '$lib/messages/messages';
import { compressImage, isAcceptedImage, type CompressedImage } from './compress';
import type { ImageSize } from './image-size';

export type PhotoDraft = {
	key: number;
	file: File;
	width: number;
	height: number;
	generation: number;
	previewUrl: string | null;
	image: CompressedImage | null;
	imageGeneration: number;
};

export type PhotoDrafts = ReturnType<typeof createPhotoDrafts>;

const unknownSize: ImageSize = { width: 1, height: 1 };

function measure(file: File): Promise<ImageSize> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		const finish = (size: ImageSize) => {
			URL.revokeObjectURL(url);
			resolve(size);
		};
		image.onload = () =>
			finish(
				image.naturalWidth > 0 && image.naturalHeight > 0
					? { width: image.naturalWidth, height: image.naturalHeight }
					: unknownSize
			);
		image.onerror = () => finish(unknownSize);
		image.src = url;
	});
}

export function createPhotoDrafts(onnotice: (text: string) => void) {
	let drafts = $state.raw<PhotoDraft[]>([]);
	let highQuality = $state(false);
	let spoiler = $state(false);
	let nextKey = 0;
	let whenFresh: (() => void) | null = null;

	function isFresh(draft: PhotoDraft): boolean {
		return draft.image !== null && draft.imageGeneration === draft.generation;
	}

	function settleQueued() {
		if (!whenFresh || !drafts.every(isFresh)) return;
		const callback = whenFresh;
		whenFresh = null;
		callback();
	}

	function update(key: number, change: (draft: PhotoDraft) => PhotoDraft) {
		drafts = drafts.map((draft) => (draft.key === key ? change(draft) : draft));
	}

	function remove(key: number) {
		const removed = drafts.find((draft) => draft.key === key);
		if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
		drafts = drafts.filter((draft) => draft.key !== key);
		settleQueued();
	}

	function compress(draft: PhotoDraft) {
		const { key, generation, file } = draft;
		void compressImage(file, { highQuality }).then((result) => {
			const current = drafts.find((candidate) => candidate.key === key);
			if (!current || current.generation !== generation) return;
			if (!result.ok) {
				remove(key);
				onnotice(
					result.reason === 'too_large'
						? 'Файл больше 50 МБ — такой не прикрепить'
						: 'Не удалось открыть это изображение'
				);
				return;
			}
			const { width, height } = result.image;
			update(key, (stale) => ({
				...stale,
				...(sameShape(stale, result.image) ? {} : { width, height }),
				image: result.image,
				imageGeneration: generation,
				previewUrl: stale.previewUrl ?? URL.createObjectURL(result.image.feed)
			}));
			settleQueued();
		});
	}

	function sameShape(measured: ImageSize, compressed: ImageSize): boolean {
		const ratio = measured.width / measured.height / (compressed.width / compressed.height);
		return Math.abs(ratio - 1) < 0.02;
	}

	async function add(files: File[]) {
		const images = files.filter(isAcceptedImage);
		if (images.length < files.length) onnotice('Можно прикрепить только фото');
		const candidates = images.slice(0, Math.max(0, attachmentMaxCount - drafts.length));
		const sizes = await Promise.all(candidates.map(measure));
		const room = Math.max(0, attachmentMaxCount - drafts.length);
		if (images.length > room) onnotice(`Не больше ${attachmentMaxCount} фото в одном сообщении`);
		const added = candidates.slice(0, room).map((file, index): PhotoDraft => ({
			key: nextKey++,
			file,
			width: sizes[index].width,
			height: sizes[index].height,
			generation: 0,
			previewUrl: null,
			image: null,
			imageGeneration: 0
		}));
		if (added.length === 0) return;
		drafts = [...drafts, ...added];
		for (const draft of added) compress(draft);
	}

	function setHighQuality(value: boolean) {
		if (value === highQuality) return;
		highQuality = value;
		drafts = drafts.map((draft) => ({ ...draft, generation: draft.generation + 1 }));
		for (const draft of drafts) compress(draft);
	}

	function afterCompression(callback: () => void) {
		whenFresh = callback;
		settleQueued();
	}

	function images(): CompressedImage[] {
		return drafts.flatMap((draft) => (draft.image ? [draft.image] : []));
	}

	function release() {
		whenFresh = null;
		for (const draft of drafts) if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
		drafts = [];
	}

	return {
		get list() {
			return drafts;
		},
		get highQuality() {
			return highQuality;
		},
		get spoiler() {
			return spoiler;
		},
		set spoiler(value: boolean) {
			spoiler = value;
		},
		get ready() {
			return drafts.length > 0 && drafts.every((draft) => draft.image !== null);
		},
		add,
		remove,
		setHighQuality,
		afterCompression,
		images,
		release
	};
}
