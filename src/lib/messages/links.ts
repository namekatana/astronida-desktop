export type TextSegment =
	| { kind: 'text'; text: string }
	| { kind: 'link'; text: string; href: string }
	| { kind: 'invite'; text: string; code: string };

const linkPattern = /https?:\/\/[^\s<>"]+|astronida:\/\/invite\/[A-Za-z0-9]{10}(?![A-Za-z0-9])/g;
const invitePattern = /^astronida:\/\/invite\/([A-Za-z0-9]{10})$/;
const trailingPunctuation = /[.,!?:;»"'\]]+$/;

function withoutTrailingPunctuation(raw: string): string {
	let link = raw.replace(trailingPunctuation, '');
	while (link.endsWith(')') && !link.includes('(')) {
		link = link.slice(0, -1).replace(trailingPunctuation, '');
	}
	return link;
}

function linkSegment(link: string): TextSegment {
	const invite = link.match(invitePattern);
	if (invite) return { kind: 'invite', text: link, code: invite[1] };
	try {
		return { kind: 'link', text: link, href: new URL(link).href };
	} catch {
		return { kind: 'text', text: link };
	}
}

export function splitLinks(text: string): TextSegment[] {
	const segments: TextSegment[] = [];
	let cursor = 0;
	for (const match of text.matchAll(linkPattern)) {
		const link = withoutTrailingPunctuation(match[0]);
		if (link.length === 0) continue;
		if (match.index > cursor)
			segments.push({ kind: 'text', text: text.slice(cursor, match.index) });
		segments.push(linkSegment(link));
		cursor = match.index + link.length;
	}
	if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
	return segments;
}
