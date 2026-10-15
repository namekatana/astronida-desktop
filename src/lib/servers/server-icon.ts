import type { AvatarImages } from '$lib/media/avatar-image';
import { postApi } from '$lib/realtime/api-request';
import { putFile, saveFailure, type ImageSaveResult } from '$lib/profile/upload-image';
import { asRecord } from '$lib/ui/record';
import { adoptServerIcon } from './server-icon-images';

type UploadTargets = { iconId: string; largeUrl: string; smallUrl: string };

function targetsFrom(body: unknown): UploadTargets | null {
	const record = asRecord(body);
	const iconId = record?.icon_id;
	const largeUrl = record?.large_upload_url;
	const smallUrl = record?.small_upload_url;
	if (typeof iconId !== 'string' || typeof largeUrl !== 'string' || typeof smallUrl !== 'string') {
		return null;
	}
	return { iconId, largeUrl, smallUrl };
}

export async function uploadServerIcon(
	serverId: string,
	images: AvatarImages
): Promise<ImageSaveResult> {
	const response = await postApi(`/servers/${serverId}/icon/uploads`, {});
	if (response?.status !== 201) return saveFailure(response);
	const targets = targetsFrom(response.body);
	if (!targets) return saveFailure(null);

	const uploaded = await Promise.all([
		putFile(targets.largeUrl, images.large),
		putFile(targets.smallUrl, images.small)
	]);
	if (uploaded.includes(false)) return saveFailure(null);

	const chosen = await postApi(`/servers/${serverId}/icon`, { icon_id: targets.iconId });
	if (chosen?.status !== 200) return saveFailure(chosen);
	adoptServerIcon(targets.iconId, images);
	return { ok: true, id: targets.iconId };
}
