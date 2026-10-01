import { invoke } from '@tauri-apps/api/core';
import type { MessageAttachment } from '$lib/messages/messages';
import { loadImageBlob } from './images';

export type SaveResult = { ok: true; path: string | null } | { ok: false };

function isTauri() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function twoDigits(value: number): string {
	return String(value).padStart(2, '0');
}

export function photoFileName(sentAt: Date, index: number, total: number): string {
	const date = `${sentAt.getFullYear()}-${twoDigits(sentAt.getMonth() + 1)}-${twoDigits(sentAt.getDate())}`;
	const time = `${twoDigits(sentAt.getHours())}-${twoDigits(sentAt.getMinutes())}-${twoDigits(sentAt.getSeconds())}`;
	const position = total > 1 ? ` ${index + 1}` : '';
	return `Astronida ${date} ${time}${position}.webp`;
}

function downloadInBrowser(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function savePhoto(attachment: MessageAttachment, name: string): Promise<SaveResult> {
	const blob = await loadImageBlob(attachment, 'full');
	if (!blob) return { ok: false };
	if (!isTauri()) {
		downloadInBrowser(blob, name);
		return { ok: true, path: null };
	}
	try {
		const bytes = new Uint8Array(await blob.arrayBuffer());
		const path = await invoke<string>('media_save_download', bytes, {
			headers: { 'x-file-name': name }
		});
		return { ok: true, path };
	} catch {
		return { ok: false };
	}
}

export function revealSavedPhoto(path: string): Promise<void> {
	return invoke('media_reveal_download', { path });
}

async function toPng(blob: Blob): Promise<Blob> {
	const bitmap = await createImageBitmap(blob);
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
	bitmap.close();
	return canvas.convertToBlob({ type: 'image/png' });
}

export async function copyPhoto(attachment: MessageAttachment): Promise<boolean> {
	const png = loadImageBlob(attachment, 'full').then((blob) => {
		if (!blob) throw new Error('photo is unavailable');
		return toPng(blob);
	});
	try {
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
		return true;
	} catch {
		return false;
	}
}

export async function photoFileSize(attachment: MessageAttachment): Promise<number | null> {
	const blob = await loadImageBlob(attachment, 'full');
	return blob?.size ?? null;
}
