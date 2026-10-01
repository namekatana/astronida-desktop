import { photoFileName, savePhoto as saveToDownloads } from '$lib/media/photo-actions';
import type { Sync } from '$lib/sync/sync';
import { toast } from '$lib/ui/toast.svelte';
import {
	deleteMessage,
	forwardMessage,
	type DeleteFailure,
	type ForwardResult
} from './message-actions';
import type { Message, MessageReply } from './messages';

interface Deleting {
	chatId: string;
	message: Message;
	busy: boolean;
	error: string | null;
}

const deleteFailureText: Record<DeleteFailure, string> = {
	forbidden: 'Нет прав удалить это сообщение',
	rate_limited: 'Слишком часто, попробуйте через минуту',
	failed: 'Не удалось удалить — проверьте соединение'
};

export function createMessageMenu(input: { chatId: () => string | null; sync: Sync }) {
	let replyTarget = $state<{ chatId: string; reply: MessageReply } | null>(null);
	let forwarding = $state<{ chatId: string; message: Message } | null>(null);
	let deleting = $state<Deleting | null>(null);
	let savingPhotos = false;

	const reply = $derived(
		replyTarget && replyTarget.chatId === input.chatId() ? replyTarget.reply : null
	);

	$effect(() => {
		if (replyTarget && replyTarget.chatId !== input.chatId()) replyTarget = null;
	});

	function startReply(message: Message) {
		const chatId = input.chatId();
		if (!chatId) return;
		replyTarget = {
			chatId,
			reply: {
				id: message.id,
				original: {
					author: message.author,
					text: message.text,
					forwardedFrom: message.forwardedFrom
				}
			}
		};
	}

	function startForward(message: Message) {
		const chatId = input.chatId();
		if (chatId) forwarding = { chatId, message };
	}

	async function forwardTo(target: {
		channelIds: string[];
		comment: string;
		clientId: string;
	}): Promise<ForwardResult> {
		const source = forwarding;
		if (!source) return { ok: false, reason: 'failed' };
		const result = await forwardMessage({
			sourceChannelId: source.chatId,
			messageId: source.message.id,
			...target
		});
		if (result.ok) {
			for (const { channelId, message } of result.delivered) input.sync.receive(channelId, message);
		}
		return result;
	}

	function startDelete(message: Message) {
		const chatId = input.chatId();
		if (chatId) deleting = { chatId, message, busy: false, error: null };
	}

	async function confirmDelete() {
		const target = deleting;
		if (!target || target.busy) return;
		target.busy = true;
		target.error = null;
		const result = await deleteMessage({ channelId: target.chatId, messageId: target.message.id });
		if (deleting !== target) return;
		if (result.ok) {
			input.sync.forget(target.chatId, target.message.id);
			deleting = null;
			toast.show('Сообщение удалено');
			return;
		}
		target.busy = false;
		target.error = deleteFailureText[result.reason];
	}

	function copy(message: Message) {
		navigator.clipboard
			.writeText(message.text)
			.then(() => toast.show('Скопировано'))
			.catch(() => {});
	}

	async function savePhotos(message: Message, indices: number[]): Promise<number> {
		const attachments = message.attachments ?? [];
		let saved = 0;
		for (const index of indices) {
			const name = photoFileName(message.sentAt, index, attachments.length);
			const result = await saveToDownloads(attachments[index], name);
			if (result.ok) saved += 1;
		}
		return saved;
	}

	async function savePhoto(message: Message, index: number) {
		if (savingPhotos || !message.attachments?.[index]) return;
		savingPhotos = true;
		const saved = await savePhotos(message, [index]);
		savingPhotos = false;
		if (saved === 1) toast.show('Фото сохранено в «Загрузки»');
		else toast.show('Не удалось сохранить фото', { failed: true });
	}

	async function saveAllPhotos(message: Message) {
		const total = message.attachments?.length ?? 0;
		if (savingPhotos || total === 0) return;
		savingPhotos = true;
		const saved = await savePhotos(
			message,
			Array.from({ length: total }, (_, index) => index)
		);
		savingPhotos = false;
		if (saved === total) toast.show(`${total} фото сохранено в «Загрузки»`);
		else if (saved === 0) toast.show('Не удалось сохранить фото', { failed: true });
		else toast.show(`Сохранено ${saved} из ${total} фото`, { failed: true });
	}

	return {
		get reply() {
			return reply;
		},
		get forwarding() {
			return forwarding;
		},
		get deleting() {
			return deleting;
		},
		startReply,
		clearReply: () => (replyTarget = null),
		startForward,
		forwardTo,
		closeForward: () => (forwarding = null),
		startDelete,
		confirmDelete,
		closeDelete: () => (deleting = null),
		copy,
		savePhoto,
		saveAllPhotos
	};
}
