import { failureMessage, postApi } from '$lib/realtime/api-request';
import { profileRateLimited } from '$lib/profile/upload-image';
import { asRecord } from '$lib/ui/record';
import { hasVisibleContent, withoutBidiControls } from '$lib/ui/visible-text';

export const bioMaxLength = 190;
export const bioMaxLines = 4;

export type BioSaveResult = { ok: true; bio: string | null } | { ok: false; message: string };

const saveFailed = 'Не удалось сохранить описание';
const controlCharacters = /[\x00-\x09\x0B-\x1F\x7F]/g;

export function limitBioLines(text: string): string {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	if (lines.length <= bioMaxLines) return lines.join('\n');
	return [...lines.slice(0, bioMaxLines - 1), lines.slice(bioMaxLines - 1).join(' ')].join('\n');
}

export function normalizeBio(text: string): string | null {
	const spaced = limitBioLines(text).replace(/\t/g, ' ').replace(controlCharacters, '');
	const normalized = withoutBidiControls(spaced).trim();
	return hasVisibleContent(normalized) ? normalized : null;
}

export async function saveBio(text: string): Promise<BioSaveResult> {
	const response = await postApi('/profile/bio', { bio: normalizeBio(text) });
	if (response?.status !== 200) {
		return {
			ok: false,
			message: failureMessage(response, {
				limit: saveFailed,
				failed: saveFailed,
				rateLimited: profileRateLimited
			})
		};
	}
	const bio = asRecord(response.body)?.bio;
	return { ok: true, bio: typeof bio === 'string' ? bio : null };
}
