const invisibleInNames = /[­͏ᅟᅠ឴឵᠎​‌‎‏‪-‮⁠-⁤⁦-⁩ㅤ﻿ﾠ]/;
const bidiControls = /[‪-‮⁦-⁩]/g;
const visibleCharacter = /[^\s­͏ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁦-⁩⠀ㅤ︀-️﻿ﾠ]/;

export const invisibleNameMessage = 'Недопустимые невидимые символы';

export function hasInvisibleCharacters(name: string): boolean {
	return invisibleInNames.test(name);
}

export function hasVisibleContent(text: string): boolean {
	return visibleCharacter.test(text);
}

export function withoutBidiControls(text: string): string {
	return text.replace(bidiControls, '');
}
