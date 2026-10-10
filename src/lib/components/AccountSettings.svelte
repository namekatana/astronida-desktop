<script lang="ts">
	import { formatPhone, maskEmail, maskPhone } from '$lib/settings/mask';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import LockedAction from './LockedAction.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		username: string | null;
		email: string | null;
		phone: string | null;
		createdAt: string | null;
		signingOut: boolean;
		onsignout: () => void;
		onopensessions: () => void;
	}

	let { username, email, phone, createdAt, signingOut, onsignout, onopensessions }: Props =
		$props();

	let emailShown = $state(false);
	let phoneShown = $state(false);

	const registrationDate = new Intl.DateTimeFormat('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	const registeredOn = $derived.by(() => {
		if (!createdAt) return null;
		const date = new Date(createdAt);
		if (Number.isNaN(date.getTime())) return null;
		return registrationDate.format(date).replace(/\s*г\.$/, '');
	});
</script>

<section aria-labelledby="account-information">
	<h4 id="account-information" class="px-1 pb-2 text-[13px] font-semibold text-muted">
		Учётные данные
	</h4>
	<div class="rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1">
				<p class="text-[12px] leading-4 text-muted">Имя пользователя</p>
				<p class="mt-0.5 truncate text-[14px] leading-5 text-ink select-text">
					{username ? `@${username}` : '—'}
				</p>
			</div>
			{@render action('Изменить')}
		</div>

		{@render divider()}

		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1">
				{@render label(
					'Электронная почта',
					email ? emailShown : null,
					() => (emailShown = !emailShown)
				)}
				{#if email}
					{@render secret(email, maskEmail(email), emailShown)}
				{:else}
					<p class="mt-0.5 text-[14px] leading-5 text-muted">Не указана</p>
				{/if}
			</div>
			{@render action('Изменить')}
		</div>

		{@render divider()}

		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1">
				{@render label(
					'Номер телефона',
					phone ? phoneShown : null,
					() => (phoneShown = !phoneShown)
				)}
				{#if phone}
					{@render secret(formatPhone(phone), maskPhone(phone), phoneShown)}
				{:else}
					<p class="mt-0.5 text-[14px] leading-5 text-muted">Не указан</p>
				{/if}
			</div>
			{@render action(phone ? 'Изменить' : 'Добавить')}
		</div>

		{@render divider()}

		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1 opacity-40">
				<p class="text-[12px] leading-4 text-muted">Возраст</p>
				<p class="mt-0.5 truncate text-[14px] leading-5 text-muted">Не указан</p>
			</div>
			{@render action('Указать')}
		</div>

		{#if registeredOn}
			{@render divider()}

			<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
				<div class="min-w-0 flex-1">
					<p class="text-[12px] leading-4 text-muted">Дата регистрации</p>
					<p class="mt-0.5 truncate text-[14px] leading-5 text-ink">{registeredOn}</p>
				</div>
			</div>
		{/if}
	</div>
</section>

<section aria-labelledby="password-security" class="mt-6">
	<h4 id="password-security" class="px-1 pb-2 text-[13px] font-semibold text-muted">
		Пароль и безопасность
	</h4>
	<div class="mb-2 flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-4 py-3 [corner-shape:squircle]">
		<div
			class="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-ink opacity-40"
		>
			<Icon name="lock" size={16} />
		</div>
		<div class="min-w-0 flex-1 opacity-40">
			<p class="text-[14px] leading-5 font-semibold text-ink">Защитите учётную запись</p>
			<p class="mt-0.5 text-[12px] leading-4 text-muted">
				Включите двухфакторную аутентификацию — при входе понадобится ещё код из
				приложения-аутентификатора
			</p>
		</div>
		{@render action('Включить')}
	</div>
	<div class="rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
			<p class="min-w-0 flex-1 truncate text-[14px] leading-5 text-ink opacity-40">Пароль</p>
			{@render action('Изменить')}
		</div>

		{@render divider()}

		<button
			type="button"
			onclick={onopensessions}
			class="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.03]"
		>
			<span class="min-w-0 flex-1 truncate text-[14px] leading-5 text-ink">Активные сеансы</span>
			<Icon name="chevron" size={14} class="shrink-0 -rotate-90 text-muted" />
		</button>
	</div>
</section>

<section aria-labelledby="account-management" class="mt-6">
	<h4 id="account-management" class="px-1 pb-2 text-[13px] font-semibold text-muted">
		Управление
	</h4>
	<div class="rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-[14px] leading-5 text-ink">Выйти из учётной записи</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">Только на этом устройстве</p>
			</div>
			<button
				type="button"
				disabled={signingOut}
				onclick={onsignout}
				class="pressable grid h-8 shrink-0 place-items-center rounded-full bg-white/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12] disabled:pointer-events-none"
			>
				<span
					class="col-start-1 row-start-1 transition-opacity duration-150 {signingOut
						? 'opacity-0'
						: 'opacity-100'}"
				>
					Выйти
				</span>
				<Orbit
					size={16}
					class="col-start-1 row-start-1 transition-opacity duration-150 {signingOut
						? 'opacity-100'
						: 'opacity-0'}"
				/>
			</button>
		</div>

		{@render divider()}

		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1 opacity-40">
				<p class="truncate text-[14px] leading-5 text-ink">Скачать мои данные</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
					Архив профиля, друзей и сообщений
				</p>
			</div>
			{@render action('Запросить')}
		</div>

		{@render divider()}

		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1 opacity-40">
				<p class="truncate text-[14px] leading-5 text-ink">Отключить учётную запись</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
					Временно скрыть профиль; можно вернуться, войдя снова
				</p>
			</div>
			{@render action('Отключить')}
		</div>

		{@render divider()}

		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1 opacity-40">
				<p class="truncate text-[14px] leading-5 text-danger">Удалить учётную запись</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
					Навсегда, без возможности восстановления
				</p>
			</div>
			{@render action('Удалить')}
		</div>
	</div>
</section>

{#snippet label(text: string, shown: boolean | null, toggle: () => void)}
	<p class="flex items-center gap-2 text-[12px] leading-4 text-muted">
		{text}
		{#if shown !== null}
			<button
				type="button"
				aria-pressed={shown}
				onclick={toggle}
				class="font-semibold text-ink-secondary transition-colors duration-150 hover:text-ink"
			>
				{shown ? 'Скрыть' : 'Показать'}
			</button>
		{/if}
	</p>
{/snippet}

{#snippet secret(value: string, masked: string, shown: boolean)}
	<div class="mt-0.5 grid min-w-0 grid-cols-1">
		{#key shown}
			<span
				in:settle
				out:settle={{ duration: 100 }}
				class="col-start-1 row-start-1 truncate text-[14px] leading-5 text-ink tabular-nums {shown
					? 'select-text'
					: 'select-none'}"
			>
				{shown ? value : masked}
			</span>
		{/key}
	</div>
{/snippet}

{#snippet action(label: string)}
	<LockedAction {label} />
{/snippet}

{#snippet divider()}
	<div class="ml-4 h-px bg-white/[0.06]"></div>
{/snippet}
