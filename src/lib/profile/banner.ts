import { postApi } from '$lib/realtime/api-request';
import { asRecord } from '$lib/ui/record';
import { adoptBanner } from './banner-images';
import { putFile, saveFailure, type ImageSaveResult } from './upload-image';

type UploadTarget = { bannerId: string; uploadUrl: string };

function targetFrom(body: unknown): UploadTarget | null {
	const record = asRecord(body);
	const bannerId = record?.banner_id;
	const uploadUrl = record?.upload_url;
	if (typeof bannerId !== 'string' || typeof uploadUrl !== 'string') return null;
	return { bannerId, uploadUrl };
}

async function chooseBanner(bannerId: string | null): Promise<ImageSaveResult> {
	const response = await postApi('/profile/banner', { banner_id: bannerId });
	if (response?.status !== 200) return saveFailure(response);
	return { ok: true, id: bannerId };
}

export function removeBanner(): Promise<ImageSaveResult> {
	return chooseBanner(null);
}

export async function uploadBanner(image: Blob): Promise<ImageSaveResult> {
	const response = await postApi('/profile/banner/uploads', {});
	if (response?.status !== 201) return saveFailure(response);
	const target = targetFrom(response.body);
	if (!target) return saveFailure(null);
	if (!(await putFile(target.uploadUrl, image))) return saveFailure(null);

	const result = await chooseBanner(target.bannerId);
	if (result.ok) adoptBanner(target.bannerId, image);
	return result;
}
