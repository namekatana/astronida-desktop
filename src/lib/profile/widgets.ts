import { failureMessage, postApi } from '$lib/realtime/api-request';
import { profileRateLimited } from '$lib/profile/upload-image';
import type { BrandName } from '$lib/ui/brands';
import type { IconName } from '$lib/ui/icons';
import { asRecord } from '$lib/ui/record';
import { hasVisibleContent, withoutBidiControls } from '$lib/ui/visible-text';

export type WidgetType = 'bio' | 'links' | 'server';
export type WidgetWidth = 1 | 2;
export type ShelfState = 'available' | 'placed' | 'full' | 'no-server';

export interface ProfileLink {
	url: string;
	label: string | null;
}

interface WidgetSize {
	width: WidgetWidth;
	height: number;
}

export type ProfileWidget =
	| (WidgetSize & { type: 'bio' })
	| (WidgetSize & { type: 'links'; links: ProfileLink[] })
	| (WidgetSize & { type: 'server'; serverId: string; inviteCode: string | null });

export type WidgetsSaveResult =
	| { ok: true; widgets: ProfileWidget[] | null }
	| { ok: false; message: string };

export type LinkInputResult = { ok: true; link: ProfileLink } | { ok: false; message: string };

export const widgetTypes: WidgetType[] = ['bio', 'links', 'server'];
export const linksMaxCount = 5;
export const linkUrlMaxLength = 256;
export const linkLabelMaxLength = 32;
export const widgetMaxHeight = 4;

export const widgetTitles: Record<WidgetType, string> = {
	bio: 'О себе',
	links: 'Ссылки',
	server: 'Мой сервер'
};

export const widgetIcons: Record<WidgetType, IconName> = {
	bio: 'note',
	links: 'link',
	server: 'users'
};

export const defaultWidgets: ProfileWidget[] = [{ type: 'bio', width: 2, height: 1 }];

const linksChromePx = 42;
const linkRowPx = 36;
const inviteCodePattern = /^[A-Za-z0-9]{10}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const saveFailed = 'Не удалось сохранить виджеты';
const explicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i;
const forbiddenUrlCharacters = /[\s\x00-\x1F\x7F­​-‏‪-‮⁠-⁤⁦-⁩﻿]/;
const controlCharacters = /[\x00-\x1F\x7F]/g;

const domainBrands: [string, BrandName][] = [
	['github.com', 'github'],
	['t.me', 'telegram'],
	['telegram.me', 'telegram'],
	['telegram.org', 'telegram'],
	['youtube.com', 'youtube'],
	['youtu.be', 'youtube'],
	['twitch.tv', 'twitch'],
	['steamcommunity.com', 'steam'],
	['steampowered.com', 'steam'],
	['x.com', 'x'],
	['twitter.com', 'x']
];

function widthFrom(value: unknown): WidgetWidth | null {
	return value === 1 || value === 2 ? value : null;
}

function linkFrom(value: unknown): ProfileLink | null {
	const record = asRecord(value);
	if (!record || typeof record.url !== 'string' || record.url.length > linkUrlMaxLength) return null;
	if (record.label !== null && typeof record.label !== 'string') return null;
	return { url: record.url, label: record.label };
}

function heightFrom(value: unknown): number | null {
	if (value === undefined) return 1;
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= widgetMaxHeight
		? value
		: null;
}

function linksFrom(value: unknown): ProfileLink[] | null {
	if (!Array.isArray(value) || value.length > linksMaxCount) return null;
	const links = value.map(linkFrom);
	return links.some((link) => link === null) ? null : (links as ProfileLink[]);
}

function serverFieldsFrom(
	record: Record<string, unknown>
): { serverId: string; inviteCode: string | null } | null {
	const serverId = record.server_id;
	const inviteCode = record.invite_code ?? null;
	if (typeof serverId !== 'string' || !uuidPattern.test(serverId)) return null;
	if (inviteCode !== null && (typeof inviteCode !== 'string' || !inviteCodePattern.test(inviteCode))) {
		return null;
	}
	return { serverId, inviteCode };
}

function widgetFrom(value: unknown): ProfileWidget | null {
	const record = asRecord(value);
	const width = widthFrom(record?.width);
	const height = heightFrom(record?.height);
	if (!record || width === null || height === null) return null;
	if (record.type === 'bio') return { type: 'bio', width, height };
	if (record.type === 'links') {
		const links = linksFrom(record.links);
		return links ? { type: 'links', width, height, links } : null;
	}
	if (record.type === 'server') {
		const fields = serverFieldsFrom(record);
		return fields ? { type: 'server', width, height, ...fields } : null;
	}
	return null;
}

export function widgetsFrom(value: unknown): ProfileWidget[] | null | undefined {
	if (value === null) return null;
	if (!Array.isArray(value)) return undefined;
	const widgets = value.map(widgetFrom);
	if (widgets.some((widget) => widget === null)) return undefined;
	const types = widgets.map((widget) => widget!.type);
	if (new Set(types).size !== types.length) return undefined;
	return widgets as ProfileWidget[];
}

export function shownWidgets(widgets: ProfileWidget[] | null): ProfileWidget[] {
	return widgets ?? defaultWidgets;
}

export function createWidget(type: WidgetType, serverId: string | null = null): ProfileWidget {
	if (type === 'bio') return { type: 'bio', width: 1, height: 2 };
	if (type === 'links') return { type: 'links', width: 1, height: 2, links: [] };
	return { type: 'server', width: 1, height: 2, serverId: serverId ?? '', inviteCode: null };
}

function canonical(widget: ProfileWidget): ProfileWidget {
	const size = { width: widget.width, height: widget.height };
	if (widget.type === 'bio') return { type: 'bio', ...size };
	if (widget.type === 'links') {
		return {
			type: 'links',
			...size,
			links: widget.links.map((link) => ({ url: link.url, label: link.label }))
		};
	}
	return { type: 'server', ...size, serverId: widget.serverId, inviteCode: widget.inviteCode };
}

export function copyWidgets(widgets: ProfileWidget[]): ProfileWidget[] {
	return widgets.map(canonical);
}

export function sameWidgets(a: ProfileWidget[], b: ProfileWidget[]): boolean {
	return JSON.stringify(copyWidgets(a)) === JSON.stringify(copyWidgets(b));
}

function payloadOf(widget: ProfileWidget): object {
	if (widget.type !== 'server') return canonical(widget);
	return {
		type: 'server',
		width: widget.width,
		height: widget.height,
		server_id: widget.serverId,
		invite_code: widget.inviteCode
	};
}

export function linksMinimumPx(count: number): number {
	return linksChromePx + Math.max(count, 1) * linkRowPx;
}

export function sizeMinimumRows(type: WidgetType, width: WidgetWidth): number {
	return type === 'server' && width === 1 ? 2 : 1;
}

function validHost(hostname: string): boolean {
	const labels = hostname.split('.');
	return labels.length >= 2 && labels.every((label) => label.length > 0);
}

export function linkFromInput(rawUrl: string, rawLabel: string): LinkInputResult {
	const typed = rawUrl.trim();
	if (typed.length === 0) return { ok: false, message: 'Введите адрес' };
	if (forbiddenUrlCharacters.test(typed)) return { ok: false, message: 'В адресе лишние символы' };
	const withScheme = explicitScheme.test(typed) ? typed : `https://${typed}`;
	let parsed: URL;
	try {
		parsed = new URL(withScheme);
	} catch {
		return { ok: false, message: 'Это не похоже на ссылку' };
	}
	if (parsed.protocol !== 'https:') return { ok: false, message: 'Нужна ссылка https://' };
	if (parsed.username || parsed.password || !validHost(parsed.hostname)) {
		return { ok: false, message: 'Это не похоже на ссылку' };
	}
	if (parsed.href.length > linkUrlMaxLength) return { ok: false, message: 'Слишком длинный адрес' };
	return { ok: true, link: { url: parsed.href, label: normalizeLinkLabel(rawLabel) } };
}

export function normalizeLinkLabel(text: string): string | null {
	const cleaned = withoutBidiControls(text.replace(/\t/g, ' ').replace(controlCharacters, '')).trim();
	if (!hasVisibleContent(cleaned)) return null;
	return Array.from(cleaned).slice(0, linkLabelMaxLength).join('').trim();
}

function hostnameOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

export function linkBrandOf(url: string): BrandName | null {
	const hostname = hostnameOf(url);
	if (!hostname) return null;
	const match = domainBrands.find(
		([domain]) => hostname === domain || hostname.endsWith(`.${domain}`)
	);
	return match?.[1] ?? null;
}

export function displayUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.replace(/^www\./, '');
		const rest = `${parsed.pathname}${parsed.search}`.replace(/\/$/, '');
		return decodeURI(`${host}${rest}`);
	} catch {
		return url;
	}
}

export function linkHost(url: string): string {
	return displayUrl(url).split('/')[0];
}

export function linkTitle(link: ProfileLink): string {
	return link.label ?? linkHost(link.url);
}

export async function saveWidgets(widgets: ProfileWidget[]): Promise<WidgetsSaveResult> {
	const response = await postApi('/profile/widgets', { widgets: widgets.map(payloadOf) });
	if (response?.status !== 200) {
		return {
			ok: false,
			message: failureMessage(response, {
				limit: saveFailed,
				failed: saveFailed,
				rateLimited: profileRateLimited
			})
		};
	}
	const saved = widgetsFrom(asRecord(response.body)?.widgets);
	return { ok: true, widgets: saved ?? widgets };
}
