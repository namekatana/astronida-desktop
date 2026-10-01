import { pushTo } from '$lib/realtime/push';
import { fromPayload, type Message, type MessagePayload } from './messages';
import { joinedRoom } from './rooms';

export type SendResult = { ok: true; message: Message } | { ok: false; retry: boolean };

export type ForwardResult =
	| { ok: true; delivered: { channelId: string; message: Message }[] }
	| { ok: false; reason: 'rate_limited' | 'failed' };

export type PinFailure = 'limit_reached' | 'rate_limited' | 'failed';

export type DeleteFailure = 'forbidden' | 'rate_limited' | 'failed';

export const forwardMaxTargets = 10;

const retryableSendReasons = new Set(['rate_limited', 'in_progress', 'timeout', 'unavailable']);

function knownReason<T extends string>(reason: string, known: readonly T[]): T | 'failed' {
	return (known as readonly string[]).includes(reason) ? (reason as T) : 'failed';
}

export async function sendMessage(input: {
	channelId: string;
	clientId: string;
	text: string;
	replyToId?: string;
	attachmentIds?: string[];
}): Promise<SendResult> {
	const channel = joinedRoom(input.channelId);
	if (!channel) return { ok: false, retry: true };

	const attachments = input.attachmentIds ?? [];
	const outcome = await pushTo<MessagePayload>(channel, 'send', {
		content: input.text.trim(),
		client_id: input.clientId,
		reply_to_id: input.replyToId ?? null,
		...(attachments.length > 0 ? { attachments } : {})
	});
	if (outcome.ok) return { ok: true, message: fromPayload(outcome.reply) };
	return { ok: false, retry: retryableSendReasons.has(outcome.reason) };
}

export async function forwardMessage(input: {
	sourceChannelId: string;
	messageId: string;
	channelIds: string[];
	comment: string;
	clientId: string;
}): Promise<ForwardResult> {
	const channel = joinedRoom(input.sourceChannelId);
	if (!channel) return { ok: false, reason: 'failed' };

	const outcome = await pushTo<{ messages: MessagePayload[] }>(channel, 'forward', {
		message_id: input.messageId,
		channel_ids: input.channelIds,
		comment: input.comment.trim() || null,
		client_id: input.clientId
	});
	if (!outcome.ok) return { ok: false, reason: knownReason(outcome.reason, ['rate_limited']) };
	return {
		ok: true,
		delivered: outcome.reply.messages.map((payload) => ({
			channelId: payload.channel_id,
			message: fromPayload(payload)
		}))
	};
}

export async function setMessagePinned(input: {
	channelId: string;
	messageId: string;
	pinned: boolean;
}): Promise<{ ok: true } | { ok: false; reason: PinFailure }> {
	const channel = joinedRoom(input.channelId);
	if (!channel) return { ok: false, reason: 'failed' };

	const outcome = await pushTo(channel, input.pinned ? 'pin' : 'unpin', {
		message_id: input.messageId
	});
	if (outcome.ok) return { ok: true };
	return { ok: false, reason: knownReason(outcome.reason, ['limit_reached', 'rate_limited']) };
}

export async function deleteMessage(input: {
	channelId: string;
	messageId: string;
}): Promise<{ ok: true } | { ok: false; reason: DeleteFailure }> {
	const channel = joinedRoom(input.channelId);
	if (!channel) return { ok: false, reason: 'failed' };

	const outcome = await pushTo(channel, 'delete', { message_id: input.messageId });
	if (outcome.ok || outcome.reason === 'not_found') return { ok: true };
	return { ok: false, reason: knownReason(outcome.reason, ['forbidden', 'rate_limited']) };
}
