import { accessToken } from '$lib/auth/access-token';
import { apiUrl } from './api-url';

const requestTimeoutMs = 10_000;

export interface ApiResponse {
	status: number;
	body: unknown;
}

export function postApi(path: string, body: Record<string, unknown>): Promise<ApiResponse | null> {
	return requestApi(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export function getApi(path: string): Promise<ApiResponse | null> {
	return requestApi(path, { method: 'GET' });
}

async function requestApi(
	path: string,
	init: { method: string; headers?: Record<string, string>; body?: string }
): Promise<ApiResponse | null> {
	try {
		const token = await accessToken();
		if (!token) return null;
		const response = await fetch(apiUrl(path), {
			...init,
			headers: { ...init.headers, Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(requestTimeoutMs)
		});
		return { status: response.status, body: await response.json().catch(() => null) };
	} catch {
		return null;
	}
}

function errorOf(response: ApiResponse): string | null {
	const body = response.body;
	if (typeof body !== 'object' || body === null || !('error' in body)) return null;
	return typeof body.error === 'string' ? body.error : null;
}

export function failureMessage(
	response: ApiResponse | null,
	messages: { limit: string; failed: string; rateLimited?: string }
): string {
	if (response?.status === 429) {
		return messages.rateLimited ?? 'Слишком часто, попробуйте через минуту';
	}
	if (response && errorOf(response) === 'limit_reached') return messages.limit;
	return messages.failed;
}
