import { beforeEach, describe, expect, it, vi } from 'vitest';

const postApi = vi.fn();

vi.mock('$lib/realtime/api-request', () => ({
	postApi: (path: string, body: unknown) => postApi(path, body),
	failureMessage: () => 'failed'
}));

vi.mock('$lib/profile/upload-image', () => ({ profileRateLimited: 'rate limited' }));

const {
	linkBrandOf,
	linkFromInput,
	linksMinimumPx,
	normalizeLinkLabel,
	sameWidgets,
	saveWidgets,
	sizeMinimumRows,
	widgetsFrom
} = await import('./widgets');

const serverId = '6f1c2c3e-1b2a-4c5d-8e9f-0a1b2c3d4e5f';

describe('widgetsFrom', () => {
	it('keeps null as the default layout and rejects anything that is not a list', () => {
		expect(widgetsFrom(null)).toBeNull();
		expect(widgetsFrom(undefined)).toBeUndefined();
		expect(widgetsFrom('[]')).toBeUndefined();
		expect(widgetsFrom({ type: 'bio' })).toBeUndefined();
	});

	it('gives old layouts without height the default height', () => {
		expect(widgetsFrom([{ type: 'bio', width: 2 }])).toEqual([
			{ type: 'bio', width: 2, height: 1 }
		]);
	});

	it('reads links and server widgets from the snake case payload', () => {
		expect(
			widgetsFrom([
				{ type: 'links', width: 1, height: 2, links: [{ url: 'https://a.io/', label: null }] },
				{ type: 'server', width: 1, height: 2, server_id: serverId, invite_code: 'Ab3dE6gH9k' }
			])
		).toEqual([
			{ type: 'links', width: 1, height: 2, links: [{ url: 'https://a.io/', label: null }] },
			{ type: 'server', width: 1, height: 2, serverId, inviteCode: 'Ab3dE6gH9k' }
		]);
	});

	it('rejects the whole layout when one widget is broken', () => {
		const broken = [
			[{ type: 'bio', width: 3, height: 1 }],
			[{ type: 'bio', width: 1, height: 5 }],
			[{ type: 'bio', width: 1, height: '2' }],
			[{ type: 'photos', width: 1, height: 1 }],
			[{ type: 'links', width: 1, height: 1, links: Array(6).fill({ url: 'https://a.io', label: null }) }],
			[{ type: 'links', width: 1, height: 1, links: [{ url: 42, label: null }] }],
			[{ type: 'server', width: 1, height: 2, server_id: 'nope' }],
			[{ type: 'server', width: 1, height: 2, server_id: serverId, invite_code: 'short' }],
			[
				{ type: 'bio', width: 1, height: 1 },
				{ type: 'bio', width: 1, height: 1 }
			]
		];
		for (const layout of broken) expect(widgetsFrom(layout)).toBeUndefined();
	});
});

describe('linkFromInput', () => {
	it('adds https when the scheme is missing and normalises the address', () => {
		expect(linkFromInput('  github.com/katana  ', '')).toEqual({
			ok: true,
			link: { url: 'https://github.com/katana', label: null }
		});
	});

	it('rejects addresses that are not plain https links', () => {
		const rejected = [
			['', 'Введите адрес'],
			['http://github.com', 'Нужна ссылка https://'],
			['https://user:pass@github.com', 'Это не похоже на ссылку'],
			['https://localhost', 'Это не похоже на ссылку'],
			['https://github..com', 'Это не похоже на ссылку'],
			['github com', 'В адресе лишние символы'],
			[`https://a.io/${'x'.repeat(260)}`, 'Слишком длинный адрес']
		];
		for (const [url, message] of rejected) {
			expect(linkFromInput(url, '')).toEqual({ ok: false, message });
		}
	});
});

describe('normalizeLinkLabel', () => {
	it('trims, replaces tabs, drops direction controls and empty labels', () => {
		expect(normalizeLinkLabel('  Мой\tблог  ')).toBe('Мой блог');
		expect(normalizeLinkLabel(`${String.fromCodePoint(0x202e)}GitHub`)).toBe('GitHub');
		expect(normalizeLinkLabel('   ')).toBeNull();
		expect(normalizeLinkLabel(String.fromCodePoint(0x200b))).toBeNull();
	});

	it('cuts labels to 32 characters', () => {
		expect(normalizeLinkLabel('а'.repeat(40))).toBe('а'.repeat(32));
	});
});

describe('linkBrandOf', () => {
	it('knows brands by domain and subdomain only', () => {
		expect(linkBrandOf('https://github.com/katana')).toBe('github');
		expect(linkBrandOf('https://gist.github.com/x')).toBe('github');
		expect(linkBrandOf('https://www.youtube.com/@x')).toBe('youtube');
		expect(linkBrandOf('https://twitter.com/x')).toBe('x');
		expect(linkBrandOf('https://notgithub.com/')).toBeNull();
		expect(linkBrandOf('not a url')).toBeNull();
	});
});

describe('sizes', () => {
	it('grows the links minimum by one row per link and counts the empty state as one', () => {
		expect(linksMinimumPx(0)).toBe(linksMinimumPx(1));
		expect(linksMinimumPx(3) - linksMinimumPx(2)).toBe(36);
	});

	it('keeps a half width server widget at least two rows high', () => {
		expect(sizeMinimumRows('server', 1)).toBe(2);
		expect(sizeMinimumRows('server', 2)).toBe(1);
		expect(sizeMinimumRows('bio', 1)).toBe(1);
	});
});

describe('sameWidgets', () => {
	it('ignores key order and extra fields', () => {
		const stored = JSON.parse(
			'[{"height":1,"width":2,"type":"bio"},{"links":[{"label":null,"url":"https://a.io/"}],"type":"links","width":1,"height":2}]'
		);
		const draft = [
			{ type: 'bio', width: 2, height: 1, extra: true },
			{ type: 'links', width: 1, height: 2, links: [{ url: 'https://a.io/', label: null }] }
		];
		expect(sameWidgets(stored, draft as never)).toBe(true);
		expect(sameWidgets(stored, [draft[1], draft[0]] as never)).toBe(false);
	});
});

describe('saveWidgets', () => {
	beforeEach(() => postApi.mockReset());

	it('sends the server widget in snake case and adopts the normalised answer', async () => {
		postApi.mockResolvedValue({
			status: 200,
			body: {
				widgets: [
					{ type: 'server', width: 1, height: 2, server_id: serverId, invite_code: 'Ab3dE6gH9k' }
				]
			}
		});
		const result = await saveWidgets([
			{ type: 'server', width: 1, height: 2, serverId, inviteCode: null }
		]);
		expect(postApi).toHaveBeenCalledWith('/profile/widgets', {
			widgets: [{ type: 'server', width: 1, height: 2, server_id: serverId, invite_code: null }]
		});
		expect(result).toEqual({
			ok: true,
			widgets: [{ type: 'server', width: 1, height: 2, serverId, inviteCode: 'Ab3dE6gH9k' }]
		});
	});

	it('keeps the draft when the answer cannot be read and reports failures', async () => {
		const draft = [{ type: 'bio' as const, width: 2 as const, height: 1 }];
		postApi.mockResolvedValueOnce({ status: 200, body: { widgets: 'broken' } });
		expect(await saveWidgets(draft)).toEqual({ ok: true, widgets: draft });
		postApi.mockResolvedValueOnce({ status: 429, body: { error: 'rate_limited' } });
		expect(await saveWidgets(draft)).toEqual({ ok: false, message: 'failed' });
		postApi.mockResolvedValueOnce(null);
		expect(await saveWidgets(draft)).toEqual({ ok: false, message: 'failed' });
	});
});
