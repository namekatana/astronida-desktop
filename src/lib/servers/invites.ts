import { createCachedSection } from '$lib/cache/cached-section';
import { failureMessage, getApi, postApi, type ApiResponse } from '$lib/realtime/api-request';
import { asRecord } from '$lib/ui/record';
import { rememberJoinedLayout } from './joined-layouts';
import { serverFrom, type Server } from './servers';

export interface InviteLink {
	link: string;
	expiresAt: Date | null;
	maxUses: number | null;
	uses: number;
}

export interface InviteSettings {
	maxAge: number | null;
	maxUses: number | null;
}

export type GenerateResult = { ok: true; invite: InviteLink } | { ok: false; message: string };

export interface InvitePreview {
	serverId: string;
	serverName: string;
	memberCount: number;
	member: boolean;
}

export type PreviewResult =
	{ ok: true; preview: InvitePreview } | { ok: false; reason: 'not_found' | 'failed' };

export type JoinResult =
	{ ok: true; server: Server } | { ok: false; message: string; missing: boolean };

export interface ServerInvite {
	code: string;
	expiresAt: Date | null;
	maxUses: number | null;
	uses: number;
	isDefault: boolean;
	joined: number;
}

export interface InviteJoiner {
	id: string;
	username: string;
	name: string;
	avatarId: string | null;
	joinedAt: Date;
}

export type ServerInvitesResult =
	{ ok: true; invites: ServerInvite[] } | { ok: false; message: string };

export type InviteJoinersResult =
	{ ok: true; joiners: InviteJoiner[] } | { ok: false; message: string };

export type RevokeResult = { ok: true } | { ok: false; message: string };

export const inviteJoinersLimit = 100;

const inviteLinkPrefix = 'astronida://invite/';
const codePattern = /^[A-Za-z0-9]{10}$/;
const linkPattern = /^(?:astronida:\/\/invite\/|https:\/\/[^\s/]+\/invite\/)([A-Za-z0-9]{10})\/?$/;
const messageLinkPattern = /astronida:\/\/invite\/([A-Za-z0-9]{10})(?![A-Za-z0-9])/;

const maxStoredPreviews = 200;

const section = createCachedSection('invites');
const requests = new Map<string, Promise<PreviewResult>>();
const storedPreviews = new Map<string, InvitePreview>();
const missingCodes = new Set<string>();

const memberPlurals = new Intl.PluralRules('ru-RU');
const memberWords: Record<string, string> = {
	one: 'участник',
	few: 'участника',
	many: 'участников',
	other: 'участника'
};

export function memberCountLabel(count: number): string {
	return `${count} ${memberWords[memberPlurals.select(count)]}`;
}

const useWords: Record<string, string> = {
	one: 'использование',
	few: 'использования',
	many: 'использований',
	other: 'использования'
};
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayMs = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function expiryPhrase(expiresAt: Date, now: Date): string {
	const time = timeFormat.format(expiresAt);
	const days = Math.round((startOfDay(expiresAt) - startOfDay(now)) / dayMs);
	if (days === 0) return `Сегодня до ${time}`;
	if (days === 1) return `До завтра, ${time}`;
	return `До ${dayFormat.format(expiresAt)}, ${time}`;
}

export function describeServerInvite(invite: ServerInvite, now: Date): string {
	const expiry = invite.expiresAt === null ? 'Бессрочная' : expiryPhrase(invite.expiresAt, now);
	const uses =
		invite.maxUses === null
			? `использовано ${invite.uses}`
			: `использовано ${invite.uses} из ${invite.maxUses}`;
	return [invite.isDefault ? 'Общая' : null, expiry, uses].filter(Boolean).join(' · ');
}

const joinedFormat = new Intl.DateTimeFormat('ru-RU', {
	day: 'numeric',
	month: 'long',
	hour: '2-digit',
	minute: '2-digit'
});

export function joinedAtLabel(joinedAt: Date): string {
	return joinedFormat.format(joinedAt);
}

export function describeInviteSettings(settings: InviteSettings, now: Date): string {
	const expiry =
		settings.maxAge === null
			? 'Бессрочная'
			: expiryPhrase(new Date(now.getTime() + settings.maxAge * 1000), now);
	const uses =
		settings.maxUses === null
			? 'без ограничений'
			: `максимум ${settings.maxUses} ${useWords[memberPlurals.select(settings.maxUses)]}`;
	return `${expiry} · ${uses}`;
}

export function inviteLinkOf(code: string): string {
	return inviteLinkPrefix + code;
}

export function parseInviteCode(text: string): string | null {
	const trimmed = text.trim();
	if (codePattern.test(trimmed)) return trimmed;
	return trimmed.match(linkPattern)?.[1] ?? null;
}

export function inviteCodeInMessage(text: string): string | null {
	return text.match(messageLinkPattern)?.[1] ?? null;
}

function inviteLinkFrom(body: unknown): InviteLink | null {
	const row = asRecord(body);
	if (typeof row?.code !== 'string' || !codePattern.test(row.code)) return null;
	if (row.expires_at !== null && typeof row.expires_at !== 'string') return null;
	if (row.max_uses !== null && typeof row.max_uses !== 'number') return null;
	if (typeof row.uses !== 'number') return null;
	return {
		link: inviteLinkOf(row.code),
		expiresAt: row.expires_at === null ? null : new Date(row.expires_at),
		maxUses: row.max_uses,
		uses: row.uses
	};
}

const prefetchIntervalMs = 60_000;
const minRemainingMs = 60_000;

const knownLinks = new Map<string, InviteLink>();
const prefetchedAt = new Map<string, number>();

export async function fetchInviteLink(serverId: string): Promise<InviteLink | null> {
	const response = await postApi(`/servers/${serverId}/invite`, {});
	const invite = response?.status === 200 ? inviteLinkFrom(response.body) : null;
	if (invite) knownLinks.set(serverId, invite);
	return invite;
}

export function cachedInviteLink(serverId: string): InviteLink | null {
	const invite = knownLinks.get(serverId);
	if (!invite) return null;
	if (invite.expiresAt && invite.expiresAt.getTime() - Date.now() < minRemainingMs) return null;
	return invite;
}

export function prefetchInviteLink(serverId: string) {
	const now = Date.now();
	if (now - (prefetchedAt.get(serverId) ?? 0) < prefetchIntervalMs) return;
	prefetchedAt.set(serverId, now);
	void fetchInviteLink(serverId);
}

export async function generateInviteLink(
	serverId: string,
	settings: InviteSettings
): Promise<GenerateResult> {
	const response = await postApi(`/servers/${serverId}/invites`, {
		max_age: settings.maxAge,
		max_uses: settings.maxUses
	});
	const invite = response?.status === 201 ? inviteLinkFrom(response.body) : null;
	if (invite) return { ok: true, invite };
	return {
		ok: false,
		message: failureMessage(response, {
			limit: 'Не удалось создать ссылку, попробуйте ещё раз',
			failed: 'Не удалось создать ссылку, попробуйте ещё раз'
		})
	};
}

function previewFrom(body: unknown): InvitePreview | null {
	const row = asRecord(body);
	const server = asRecord(row?.server);
	if (typeof server?.id !== 'string' || typeof server.name !== 'string') return null;
	if (typeof row?.member_count !== 'number' || typeof row.member !== 'boolean') return null;
	return {
		serverId: server.id,
		serverName: server.name,
		memberCount: row.member_count,
		member: row.member
	};
}

function storedPreviewFrom(entry: unknown): [string, InvitePreview] | null {
	const row = asRecord(entry);
	const preview = asRecord(row?.preview);
	if (typeof row?.code !== 'string' || !codePattern.test(row.code) || !preview) return null;
	if (typeof preview.serverId !== 'string' || typeof preview.serverName !== 'string') return null;
	if (typeof preview.memberCount !== 'number' || typeof preview.member !== 'boolean') return null;
	return [
		row.code,
		{
			serverId: preview.serverId,
			serverName: preview.serverName,
			memberCount: preview.memberCount,
			member: preview.member
		}
	];
}

export async function restoreInvitePreviews() {
	knownLinks.clear();
	prefetchedAt.clear();
	requests.clear();
	storedPreviews.clear();
	missingCodes.clear();
	const entries = await section.read();
	if (!Array.isArray(entries)) return;
	for (const entry of entries) {
		const restored = storedPreviewFrom(entry);
		if (restored) storedPreviews.set(...restored);
	}
}

function persistPreviews() {
	section.persist(() =>
		[...storedPreviews].slice(-maxStoredPreviews).map(([code, preview]) => ({ code, preview }))
	);
}

function remember(code: string, preview: InvitePreview) {
	storedPreviews.delete(code);
	storedPreviews.set(code, preview);
	missingCodes.delete(code);
	persistPreviews();
}

function forget(code: string) {
	missingCodes.add(code);
	if (storedPreviews.delete(code)) persistPreviews();
}

export function recentInvitePreviews(limit: number): { code: string; preview: InvitePreview }[] {
	const seenServers = new Set<string>();
	const recent: { code: string; preview: InvitePreview }[] = [];
	for (const [code, preview] of [...storedPreviews].reverse()) {
		if (recent.length >= limit) break;
		if (preview.member || seenServers.has(preview.serverId)) continue;
		seenServers.add(preview.serverId);
		recent.push({ code, preview });
	}
	return recent;
}

export function cachedPreview(code: string): PreviewResult | null {
	const preview = storedPreviews.get(code);
	if (preview) return { ok: true, preview };
	return missingCodes.has(code) ? { ok: false, reason: 'not_found' } : null;
}

async function requestPreview(code: string): Promise<PreviewResult> {
	const response = await getApi(`/invites/${code}`);
	if (response?.status === 404) {
		forget(code);
		return { ok: false, reason: 'not_found' };
	}
	const preview = response?.status === 200 ? previewFrom(response.body) : null;
	if (preview) {
		remember(code, preview);
		return { ok: true, preview };
	}
	requests.delete(code);
	return cachedPreview(code) ?? { ok: false, reason: 'failed' };
}

export function previewInvite(code: string): Promise<PreviewResult> {
	const known = requests.get(code);
	if (known) return known;
	const pending = requestPreview(code);
	requests.set(code, pending);
	return pending;
}

function rememberMembership(code: string) {
	const known = storedPreviews.get(code);
	if (!known || known.member) return;
	const joined = { ...known, member: true, memberCount: known.memberCount + 1 };
	remember(code, joined);
	requests.set(code, Promise.resolve({ ok: true, preview: joined }));
}

export async function joinByInvite(code: string): Promise<JoinResult> {
	const response = await postApi(`/invites/${code}/join`, {});
	const server = response?.status === 200 ? serverFrom(response.body) : null;
	if (server) {
		rememberMembership(code);
		rememberJoinedLayout(server.id, response?.body);
		return { ok: true, server };
	}
	if (response?.status === 404) {
		forget(code);
		requests.set(code, Promise.resolve({ ok: false, reason: 'not_found' }));
		return { ok: false, message: 'Приглашение недействительно или истекло', missing: true };
	}
	return {
		ok: false,
		message: failureMessage(response, {
			limit: 'Не удалось присоединиться, попробуйте ещё раз',
			failed: 'Не удалось присоединиться, попробуйте ещё раз'
		}),
		missing: false
	};
}

function managementFailure(response: ApiResponse | null): string {
	if (!response) return 'Нет связи с сервером';
	if (response.status === 429) return 'Слишком часто, попробуйте через минуту';
	if (response.status === 403) return 'Это может только создатель сервера';
	return 'Не получилось, попробуйте ещё раз';
}

function dateFrom(value: unknown): Date | null {
	if (typeof value !== 'string') return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function serverInviteFrom(value: unknown): ServerInvite | null {
	const row = asRecord(value);
	if (typeof row?.code !== 'string' || !codePattern.test(row.code)) return null;
	const expiresAt = row.expires_at === null ? null : dateFrom(row.expires_at);
	if (row.expires_at !== null && !expiresAt) return null;
	if (row.max_uses !== null && typeof row.max_uses !== 'number') return null;
	if (typeof row.uses !== 'number' || typeof row.joined !== 'number') return null;
	if (typeof row.is_default !== 'boolean') return null;
	return {
		code: row.code,
		expiresAt,
		maxUses: row.max_uses,
		uses: row.uses,
		isDefault: row.is_default,
		joined: row.joined
	};
}

function inviteJoinerFrom(value: unknown): InviteJoiner | null {
	const row = asRecord(value);
	const user = asRecord(row?.user);
	const joinedAt = dateFrom(row?.joined_at);
	if (!user || !joinedAt) return null;
	const { id, username, display_name: displayName, avatar_id: avatarId } = user;
	if (typeof id !== 'string' || typeof username !== 'string') return null;
	return {
		id,
		username,
		name: typeof displayName === 'string' ? displayName : username,
		avatarId: typeof avatarId === 'string' ? avatarId : null,
		joinedAt
	};
}

export async function loadServerInvites(serverId: string): Promise<ServerInvitesResult> {
	const response = await getApi(`/servers/${serverId}/invites`);
	const list = response?.status === 200 ? asRecord(response.body)?.invites : null;
	if (!Array.isArray(list)) return { ok: false, message: managementFailure(response) };
	const invites = list
		.map(serverInviteFrom)
		.filter((invite): invite is ServerInvite => invite !== null);
	return { ok: true, invites };
}

export async function loadInviteJoiners(
	serverId: string,
	code: string
): Promise<InviteJoinersResult> {
	const response = await getApi(`/servers/${serverId}/invites/${code}/members`);
	const list = response?.status === 200 ? asRecord(response.body)?.members : null;
	if (!Array.isArray(list)) return { ok: false, message: managementFailure(response) };
	const joiners = list
		.map(inviteJoinerFrom)
		.filter((joiner): joiner is InviteJoiner => joiner !== null);
	return { ok: true, joiners };
}

function forgetRevoked(serverId: string, code: string) {
	if (knownLinks.get(serverId)?.link === inviteLinkOf(code)) {
		knownLinks.delete(serverId);
		prefetchedAt.delete(serverId);
	}
	forget(code);
	requests.set(code, Promise.resolve({ ok: false, reason: 'not_found' }));
}

export async function revokeInvite(serverId: string, code: string): Promise<RevokeResult> {
	const response = await postApi(`/servers/${serverId}/invites/${code}/revoke`, {});
	if (response?.status !== 200 && response?.status !== 404) {
		return { ok: false, message: managementFailure(response) };
	}
	forgetRevoked(serverId, code);
	return { ok: true };
}

export function forgetServerInvites(serverId: string) {
	knownLinks.delete(serverId);
	prefetchedAt.delete(serverId);
	let changed = false;
	for (const [code, preview] of storedPreviews) {
		if (preview.serverId !== serverId) continue;
		storedPreviews.delete(code);
		requests.delete(code);
		changed = true;
	}
	if (changed) persistPreviews();
}
