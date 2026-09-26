import { AuthError } from '@supabase/supabase-js';
import { apiUrl } from '$lib/realtime/api-url';
import { disconnectPhoenix } from '$lib/realtime/socket';
import { supabase } from '$lib/supabase/client';

export type AuthResult = { ok: true } | { ok: false; message: string };

const messagesByCode: Record<string, string> = {
	invalid_credentials: 'Неверный email или пароль',
	user_already_exists: 'Этот email уже зарегистрирован',
	email_exists: 'Этот email уже зарегистрирован',
	email_not_confirmed: 'Подтвердите email по ссылке из письма',
	email_address_invalid: 'Этот email недоступен для регистрации',
	weak_password: 'Слишком простой пароль',
	over_request_rate_limit: 'Слишком много попыток, подождите минуту',
	over_email_send_rate_limit: 'Слишком много попыток, подождите минуту',
	validation_failed: 'Проверьте правильность введённых данных'
};

function describe(error: AuthError): string {
	if (error.code && messagesByCode[error.code]) {
		return messagesByCode[error.code];
	}
	if (error.name === 'AuthRetryableFetchError') {
		return 'Нет соединения с сервером';
	}
	return 'Что-то пошло не так, попробуйте ещё раз';
}

const usernameCheckTimeoutMs = 10_000;
const usernameCheckFailed: AuthResult = {
	ok: false,
	message: 'Не удалось проверить ник, попробуйте ещё раз'
};

export async function checkUsernameAvailable(username: string): Promise<AuthResult> {
	try {
		const response = await fetch(
			apiUrl(`/username/available?username=${encodeURIComponent(username)}`),
			{ signal: AbortSignal.timeout(usernameCheckTimeoutMs) }
		);
		if (response.status === 429) {
			return { ok: false, message: 'Слишком много попыток, подождите минуту' };
		}
		if (!response.ok) return usernameCheckFailed;
		const body = (await response.json()) as { available?: unknown };
		if (typeof body.available !== 'boolean') return usernameCheckFailed;
		return body.available ? { ok: true } : { ok: false, message: 'Этот ник уже занят' };
	} catch {
		return usernameCheckFailed;
	}
}

export async function signUp(input: {
	email: string;
	username: string;
	password: string;
}): Promise<AuthResult> {
	const { data, error } = await supabase.auth.signUp({
		email: input.email,
		password: input.password,
		options: { data: { username: input.username } }
	});

	if (error) {
		if (error.status === 500) {
			return { ok: false, message: 'Не удалось создать аккаунт. Возможно, ник уже занят' };
		}
		return { ok: false, message: describe(error) };
	}

	if (!data.session) {
		return { ok: false, message: 'Мы отправили письмо — подтвердите email и войдите' };
	}
	return { ok: true };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
	const { error } = await supabase.auth.signInWithPassword({
		email: input.email,
		password: input.password
	});

	if (error) {
		return { ok: false, message: describe(error) };
	}
	return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
	disconnectPhoenix();
	const { error } = await supabase.auth.signOut({ scope: 'local' });

	if (error) {
		return { ok: false, message: describe(error) };
	}
	return { ok: true };
}
