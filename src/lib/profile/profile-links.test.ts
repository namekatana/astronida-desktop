import { describe, expect, it } from 'vitest';
import { splitLinks } from '$lib/messages/links';
import {
	profileLinkOf,
	profileLinkPreview,
	profileUsernameInMessage,
	profileUsernameOfLink
} from './profile-links';

describe('profile links', () => {
	it('builds and parses a link', () => {
		const link = profileLinkOf('night_owl');
		expect(link).toBe('astronida://user/night_owl');
		expect(profileUsernameOfLink(link)).toBe('night_owl');
	});

	it('rejects malformed usernames', () => {
		expect(profileUsernameOfLink('astronida://user/ab')).toBeNull();
		expect(profileUsernameOfLink('astronida://user/Night')).toBeNull();
		expect(profileUsernameOfLink('astronida://user/' + 'a'.repeat(21))).toBeNull();
	});

	it('finds a link inside a message', () => {
		expect(profileUsernameInMessage('Смотри: astronida://user/night_owl!')).toBe('night_owl');
		expect(profileUsernameInMessage('astronida://user/NightOwl')).toBeNull();
		expect(profileUsernameInMessage('просто текст')).toBeNull();
	});

	it('previews only a message that is just the link', () => {
		expect(profileLinkPreview('  astronida://user/night_owl ')).toBe('Профиль @night_owl');
		expect(profileLinkPreview('привет astronida://user/night_owl')).toBeNull();
	});

	it('splits a profile link out of text', () => {
		expect(splitLinks('это astronida://user/night_owl.')).toEqual([
			{ kind: 'text', text: 'это ' },
			{ kind: 'profile', text: 'astronida://user/night_owl', username: 'night_owl' },
			{ kind: 'text', text: '.' }
		]);
	});
});
