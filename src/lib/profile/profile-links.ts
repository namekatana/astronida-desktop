const profileLinkPrefix = 'astronida://user/';
const usernameSource = '[a-z0-9_]{3,20}';

export const profileLinkSource = `astronida:\\/\\/user\\/${usernameSource}(?![A-Za-z0-9_])`;

const exactLinkPattern = new RegExp(`^astronida:\\/\\/user\\/(${usernameSource})$`);
const messageLinkPattern = new RegExp(`astronida:\\/\\/user\\/(${usernameSource})(?![A-Za-z0-9_])`);

export function profileLinkOf(username: string): string {
	return profileLinkPrefix + username;
}

export function profileUsernameOfLink(link: string): string | null {
	return link.match(exactLinkPattern)?.[1] ?? null;
}

export function profileUsernameInMessage(text: string): string | null {
	return text.match(messageLinkPattern)?.[1] ?? null;
}

export function profileLinkPreview(text: string): string | null {
	const username = profileUsernameOfLink(text.trim());
	return username === null ? null : `Профиль @${username}`;
}
