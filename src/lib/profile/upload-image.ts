import { PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { failureMessage, type ApiResponse } from '$lib/realtime/api-request';

export type ImageSaveResult = { ok: true; id: string | null } | { ok: false; message: string };

const uploadTimeoutMs = 60_000;
const saveFailed = 'Не удалось сохранить фото';

export const profileRateLimited = 'Слишком часто — попробуйте через несколько минут';

export function saveFailure(response: ApiResponse | null): ImageSaveResult {
	return {
		ok: false,
		message: failureMessage(response, {
			limit: saveFailed,
			failed: saveFailed,
			rateLimited: profileRateLimited
		})
	};
}

export async function putFile(url: string, blob: Blob): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Content-Type': blob.type,
				'Cache-Control': 'max-age=31536000',
				'x-upsert': 'false',
				apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY
			},
			body: blob,
			signal: AbortSignal.timeout(uploadTimeoutMs)
		});
		return response.ok;
	} catch {
		return false;
	}
}
