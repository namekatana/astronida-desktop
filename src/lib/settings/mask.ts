const hiddenMark = '•';
const hiddenEmailLength = 9;
const visiblePhoneTail = 2;

export function maskEmail(email: string): string {
	const at = email.lastIndexOf('@');
	const domain = at > 0 ? email.slice(at) : '';
	return `${hiddenMark.repeat(hiddenEmailLength)}${domain}`;
}

function phoneDigits(phone: string): string {
	return phone.replace(/\D/g, '');
}

export function formatPhone(phone: string): string {
	return `+${phoneDigits(phone)}`;
}

export function maskPhone(phone: string): string {
	const digits = phoneDigits(phone);
	const tail = digits.slice(-visiblePhoneTail);
	const hidden = (count: number) => hiddenMark.repeat(count);
	return `+${digits.slice(0, 1)} ${hidden(3)} ${hidden(3)} ${hidden(2)} ${tail}`;
}
