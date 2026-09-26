const invisibleInNames =
	/[­͏ᅟᅠ឴឵᠎​‌‎‏‪-‮⁠-⁤⁦-⁩ㅤ﻿ﾠ]/;
const bidiControls = /[‪-‮⁦-⁩]/g;

export const invisibleNameMessage = 'Недопустимые невидимые символы';

export function hasInvisibleCharacters(name: string): boolean {
	return invisibleInNames.test(name);
}

export function withoutBidiControls(text: string): string {
	return text.replace(bidiControls, '');
}
