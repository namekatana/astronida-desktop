export interface PasswordRule {
	id: string;
	label: string;
	test: (password: string) => boolean;
}

export const minPasswordLength = 8;

export const passwordRules: PasswordRule[] = [
	{
		id: 'length',
		label: `Минимум ${minPasswordLength} символов`,
		test: (password) => password.length >= minPasswordLength
	},
	{
		id: 'uppercase',
		label: 'Хотя бы одна заглавная буква',
		test: (password) => /[A-ZА-ЯЁ]/.test(password)
	},
	{
		id: 'special',
		label: 'Хотя бы один спецсимвол (!, ?, #, _ …)',
		test: (password) => /[^\p{L}\p{N}]/u.test(password)
	}
];

export function firstFailedRule(password: string): PasswordRule | undefined {
	return passwordRules.find((rule) => !rule.test(password));
}
