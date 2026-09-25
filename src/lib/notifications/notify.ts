import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';

export type NotificationTarget = { kind: 'direct'; channelId: string } | { kind: 'requests' };

const activatedEvent = 'notification-activated';
const bodyMaxLength = 180;
const requestsTarget = 'requests';
const directPrefix = 'direct:';

function inTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function encodeTarget(target: NotificationTarget): string {
	return target.kind === 'direct' ? `${directPrefix}${target.channelId}` : requestsTarget;
}

function decodeTarget(raw: string): NotificationTarget | null {
	if (raw === requestsTarget) return { kind: 'requests' };
	if (raw.startsWith(directPrefix))
		return { kind: 'direct', channelId: raw.slice(directPrefix.length) };
	return null;
}

function shorten(text: string): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	return flat.length > bodyMaxLength ? `${flat.slice(0, bodyMaxLength - 1)}…` : flat;
}

export async function showNotification(input: {
	title: string;
	body: string;
	target: NotificationTarget;
}) {
	if (!inTauri()) return;
	await invoke('notify_show', {
		request: { title: input.title, body: shorten(input.body), target: encodeTarget(input.target) }
	}).catch(() => {});
}

export async function requestAttention() {
	if (!inTauri()) return;
	await getCurrentWindow()
		.requestUserAttention(UserAttentionType.Informational)
		.catch(() => {});
}

export function onNotificationActivated(handler: (target: NotificationTarget) => void): () => void {
	if (!inTauri()) return () => {};
	const unlisten = listen<string>(activatedEvent, (event) => {
		const target = decodeTarget(event.payload);
		if (target) handler(target);
	});
	return () => {
		void unlisten.then((stop) => stop());
	};
}
