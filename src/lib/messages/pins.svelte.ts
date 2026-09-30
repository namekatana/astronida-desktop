import { untrack } from 'svelte';
import type { Sync } from '$lib/sync/sync';
import { cachedPinned, storePinned } from './pins-cache';
import {
	loadPinnedMessages,
	setMessagePinned,
	subscribeToPins,
	type Message,
	type PinFailure
} from './messages';

const hiddenStorageKey = 'astronida.pins.hidden';
const errorVisibleMs = 3000;

function readHidden(): Record<string, string[]> {
	try {
		const stored = JSON.parse(localStorage.getItem(hiddenStorageKey) ?? '{}');
		return stored && typeof stored === 'object' ? stored : {};
	} catch {
		return {};
	}
}

function writeHidden(hidden: Record<string, string[]>) {
	try {
		localStorage.setItem(hiddenStorageKey, JSON.stringify(hidden));
	} catch {
		return;
	}
}

function newestFirst(messages: Message[]): Message[] {
	return [...messages].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

const failureText: Record<PinFailure, string> = {
	limit_reached: 'Можно закрепить не больше 50 сообщений',
	rate_limited: 'Слишком часто, попробуйте через минуту',
	failed: 'Не удалось изменить закреплённые'
};

export function createPins(input: { chatId: () => string | null; sync: Sync }) {
	let byChannel = $state<Record<string, Message[]>>({});
	let hidden = $state<Record<string, string[]>>(readHidden());
	let position = $state(0);
	let error = $state<string | null>(null);
	const busyIds = new Set<string>();
	let errorTimer: ReturnType<typeof setTimeout> | undefined;

	const list = $derived.by((): Message[] => {
		const channelId = input.chatId();
		return channelId ? (byChannel[channelId] ?? []) : [];
	});

	const pinnedIds = $derived(new Set(list.map((message) => message.id)));

	const collapsed = $derived.by(() => {
		const channelId = input.chatId();
		const hiddenIds = channelId ? hidden[channelId] : undefined;
		if (!hiddenIds) return false;
		const known = new Set(hiddenIds);
		return list.every((message) => known.has(message.id));
	});

	const current = $derived(list.length > 0 ? list[position % list.length] : null);

	function update(channelId: string, messages: Message[]) {
		byChannel[channelId] = messages;
		storePinned(channelId, messages);
	}

	async function reload(channelId: string) {
		const loaded = await loadPinnedMessages(channelId);
		if (loaded) update(channelId, newestFirst(loaded));
	}

	function place(channelId: string, message: Message) {
		const existing = byChannel[channelId] ?? [];
		if (existing.some((known) => known.id === message.id)) return;
		update(channelId, newestFirst([...existing, message]));
	}

	function remove(channelId: string, messageId: string) {
		const existing = byChannel[channelId];
		if (existing) update(channelId, existing.filter((known) => known.id !== messageId));
	}

	function forget(channelId: string, messageId: string) {
		const known = byChannel[channelId] ?? cachedPinned(channelId);
		if (known?.some((message) => message.id === messageId)) {
			update(channelId, known.filter((message) => message.id !== messageId));
		}
	}

	$effect(() => input.sync.onForget(forget));

	$effect(() => {
		const channelId = input.chatId();
		position = 0;
		error = null;
		if (!channelId) return;

		const cached = cachedPinned(channelId);
		if (cached && !untrack(() => channelId in byChannel)) byChannel[channelId] = cached;

		let stale = false;
		const unsubscribe = subscribeToPins({
			channelId,
			onReady: () => {
				if (!stale) void reload(channelId);
			},
			onPinned: (messageId, pinned) => {
				if (stale) return;
				if (!pinned) remove(channelId, messageId);
				else if (!byChannel[channelId]?.some((known) => known.id === messageId)) {
					void reload(channelId);
				}
			}
		});
		return () => {
			stale = true;
			unsubscribe();
		};
	});

	function showError(text: string) {
		clearTimeout(errorTimer);
		error = text;
		errorTimer = setTimeout(() => (error = null), errorVisibleMs);
	}

	async function toggle(message: Message) {
		const channelId = input.chatId();
		if (!channelId || busyIds.has(message.id)) return;
		const pinned = !pinnedIds.has(message.id);
		busyIds.add(message.id);
		const result = await setMessagePinned({ channelId, messageId: message.id, pinned });
		busyIds.delete(message.id);
		if (!result.ok) {
			showError(failureText[result.reason]);
			return;
		}
		if (pinned) {
			place(channelId, message);
			position = list.findIndex((known) => known.id === message.id);
		} else {
			remove(channelId, message.id);
		}
	}

	function advance() {
		if (list.length > 1) position = (position + 1) % list.length;
	}

	function collapse() {
		const channelId = input.chatId();
		if (!channelId) return;
		hidden[channelId] = list.map((message) => message.id);
		writeHidden(hidden);
	}

	function expand() {
		const channelId = input.chatId();
		if (!channelId) return;
		delete hidden[channelId];
		writeHidden(hidden);
	}

	return {
		get list() {
			return list;
		},
		get pinnedIds() {
			return pinnedIds;
		},
		get current() {
			return current;
		},
		get position() {
			return list.length > 0 ? position % list.length : 0;
		},
		get collapsed() {
			return collapsed;
		},
		get error() {
			return error;
		},
		toggle,
		advance,
		collapse,
		expand
	};
}
