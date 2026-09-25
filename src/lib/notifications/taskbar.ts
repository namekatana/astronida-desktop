import { Image } from '@tauri-apps/api/image';
import { getCurrentWindow } from '@tauri-apps/api/window';

const badgeSize = 32;
const badgeColor = '#e0605f';
const labelColor = '#ffffff';
const maxShownCount = 9;

let shownLabel: string | null = null;

function inTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function labelFor(count: number): string | null {
	if (count <= 0) return null;
	return count > maxShownCount ? `${maxShownCount}+` : String(count);
}

function drawBadge(label: string): Uint8Array | null {
	const canvas = document.createElement('canvas');
	canvas.width = badgeSize;
	canvas.height = badgeSize;
	const context = canvas.getContext('2d');
	if (!context) return null;

	context.fillStyle = badgeColor;
	context.beginPath();
	context.arc(badgeSize / 2, badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
	context.fill();

	context.fillStyle = labelColor;
	context.font = `600 ${label.length > 1 ? 17 : 21}px 'Geist Variable', 'Segoe UI', sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(label, badgeSize / 2, badgeSize / 2 + 1);

	return new Uint8Array(context.getImageData(0, 0, badgeSize, badgeSize).data.buffer);
}

export async function setTaskbarBadge(count: number) {
	if (!inTauri()) return;
	const label = labelFor(count);
	if (label === shownLabel) return;
	shownLabel = label;

	const appWindow = getCurrentWindow();
	if (!label) {
		await appWindow.setOverlayIcon(undefined).catch(() => {});
		return;
	}
	const rgba = drawBadge(label);
	if (!rgba) return;
	const image = await Image.new(rgba, badgeSize, badgeSize);
	await appWindow.setOverlayIcon(image).catch(() => {});
}
