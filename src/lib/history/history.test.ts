import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/messages/messages';
import { history } from './history';

vi.mock('$lib/supabase/client', () => ({ supabase: {} }));

const channelId = 'channel';
const author = { id: 'author', username: 'author', name: 'Author' };

function message(id: string, text: string, replyTo?: string): Message {
	const result: Message = { id, author, text, sentAt: new Date('2026-10-07T10:00:00Z') };
	if (replyTo) {
		result.replyTo = { id: replyTo, original: { author, text: 'old text' } };
	}
	return result;
}

describe('history.editMessage', () => {
	beforeEach(async () => {
		await history.open('user');
		await history.clear();
	});

	it('replaces the text and marks the message as edited', async () => {
		await history.store(channelId, [message('a', 'old text')]);

		await history.editMessage(channelId, 'a', 'new text');

		const { messages } = await history.page(channelId);
		expect(messages[0].text).toBe('new text');
		expect(messages[0].edited).toBe(true);
	});

	it('updates quotes of replies to the edited message', async () => {
		await history.store(channelId, [message('a', 'old text'), message('b', 'reply', 'a')]);

		await history.editMessage(channelId, 'a', 'new text');

		const { messages } = await history.page(channelId);
		expect(messages[1].replyTo?.original?.text).toBe('new text');
	});

	it('ignores a message from another channel', async () => {
		await history.store(channelId, [message('a', 'old text')]);

		await history.editMessage('other', 'a', 'new text');

		const { messages } = await history.page(channelId);
		expect(messages[0].text).toBe('old text');
		expect(messages[0].edited).toBeUndefined();
	});
});
