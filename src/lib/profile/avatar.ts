import type { AvatarImages } from '$lib/media/avatar-image';
import { postApi } from '$lib/realtime/api-request';
import { asRecord } from '$lib/ui/record';
import { adoptAvatar } from './avatar-images';
import { putFile, saveFailure, type ImageSaveResult } from './upload-image';

type UploadTargets = { avatarId: string; largeUrl: string; smallUrl: string };

function targetsFrom(body: unknown): UploadTargets | null {
	const record = asRecord(body);
	const avatarId = record?.avatar_id;
	const largeUrl = record?.large_upload_url;
	const smallUrl = record?.small_upload_url;
	if (
		typeof avatarId !== 'string' ||
		typeof largeUrl !== 'string' ||
		typeof smallUrl !== 'string'
	) {
		return null;
	}
	return { avatarId, largeUrl, smallUrl };
}

async function chooseAvatar(avatarId: string | null): Promise<ImageSaveResult> {
	const response = await postApi('/profile/avatar', { avatar_id: avatarId });
	if (response?.status !== 200) return saveFailure(response);
	return { ok: true, id: avatarId };
}

export function removeAvatar(): Promise<ImageSaveResult> {
	return chooseAvatar(null);
}

export async function uploadAvatar(images: AvatarImages): Promise<ImageSaveResult> {
	const response = await postApi('/profile/avatar/uploads', {});
	if (response?.status !== 201) return saveFailure(response);
	const targets = targetsFrom(response.body);
	if (!targets) return saveFailure(null);

	const uploaded = await Promise.all([
		putFile(targets.largeUrl, images.large),
		putFile(targets.smallUrl, images.small)
	]);
	if (uploaded.includes(false)) return saveFailure(null);

	const result = await chooseAvatar(targets.avatarId);
	if (result.ok) adoptAvatar(targets.avatarId, images);
	return result;
}
