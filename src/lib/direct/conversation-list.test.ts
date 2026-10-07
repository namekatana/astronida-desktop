import { describe, expect, it } from 'vitest';
import type { Friend } from '$lib/friends/friends';
import { visibleConversations } from './conversation-list';

function partner(id: string, channelId: string | null): Friend {
	return { id, username: id, name: id, channelId };
}

const newest: Record<string, string> = {
	'chat-a': '0192a000-0000-7000-8000-000000000001',
	'chat-b': '0192a000-0000-7000-8000-000000000003',
	'chat-c': '0192a000-0000-7000-8000-000000000002'
};

function visible(partners: Friend[], friendIds: string[] = []) {
	return visibleConversations({
		partners,
		friendIds: new Set(friendIds),
		newestIdOf: (channelId) => newest[channelId]
	}).map((entry) => entry.id);
}

describe('visibleConversations', () => {
	it('orders chats by their newest message, newest first', () => {
		const partners = [partner('a', 'chat-a'), partner('b', 'chat-b'), partner('c', 'chat-c')];
		expect(visible(partners)).toEqual(['b', 'c', 'a']);
	});

	it('leaves out friends, who are listed separately', () => {
		const partners = [partner('a', 'chat-a'), partner('b', 'chat-b')];
		expect(visible(partners, ['b'])).toEqual(['a']);
	});

	it('leaves out chats without messages', () => {
		const partners = [partner('a', 'chat-a'), partner('d', 'chat-empty'), partner('e', null)];
		expect(visible(partners)).toEqual(['a']);
	});

	it('puts a chat with an unsent message first', () => {
		newest['chat-pending'] = 'pending:000001791326295777:client';
		const partners = [partner('b', 'chat-b'), partner('p', 'chat-pending')];
		expect(visible(partners)).toEqual(['p', 'b']);
	});
});
