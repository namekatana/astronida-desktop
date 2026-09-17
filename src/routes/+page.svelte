<script lang="ts">
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { checkUsernameAvailable, signIn, signUp } from '$lib/auth/auth';
	import { firstFailedRule } from '$lib/auth/password-rules';
	import PasswordHint from '$lib/components/PasswordHint.svelte';
	import PillButton from '$lib/components/PillButton.svelte';
	import PillInput from '$lib/components/PillInput.svelte';
	import StarField from '$lib/components/StarField.svelte';

	type Mode = 'login' | 'register';

	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const usernamePattern = /^[a-z0-9_]{3,20}$/;

	const toUsername = (raw: string) => raw.toLowerCase();

	let mode = $state<Mode>('login');
	let email = $state('');
	let emailTouched = $state(false);
	let username = $state('');
	let password = $state('');
	let passwordRepeat = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let serverError = $state('');

	const isRegister = $derived(mode === 'register');

	const passwordError = $derived.by(() => {
		if (!isRegister) return password.length === 0 ? 'Введите пароль' : '';
		const failed = firstFailedRule(password);
		return failed ? `Пароль: ${failed.label.toLowerCase()}` : '';
	});

	const emailMissingAt = $derived(emailTouched && email.length > 0 && !email.includes('@'));

	const emailInvalid = $derived(emailMissingAt || (submitted && !emailPattern.test(email)));
	const usernameInvalid = $derived(submitted && isRegister && !usernamePattern.test(username));
	const passwordInvalid = $derived(submitted && passwordError !== '');
	const repeatInvalid = $derived(submitted && isRegister && passwordRepeat !== password);

	const validationError = $derived(
		emailMissingAt
			? 'В email должен быть символ @'
			: emailInvalid
				? 'Введите корректный email'
				: usernameInvalid
				? 'Ник — строчные латинские буквы, цифры и _, минимум 3 символа'
				: passwordInvalid
					? passwordError
					: repeatInvalid
						? 'Пароли не совпадают'
						: ''
	);

	const error = $derived(validationError || serverError);

	$effect(() => {
		void [email, username, password, passwordRepeat];
		serverError = '';
	});

	function switchMode() {
		mode = isRegister ? 'login' : 'register';
		submitted = false;
		serverError = '';
		username = '';
		passwordRepeat = '';
	}

	async function register() {
		const availability = await checkUsernameAvailable(username);
		if (!availability.ok) return availability;
		return signUp({ email, username, password });
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validationError || submitting) return;

		submitting = true;
		const result = isRegister ? await register() : await signIn({ email, password });

		if (!result.ok) {
			submitting = false;
			serverError = result.message;
			return;
		}
		await goto('/app');
	}
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden">
	<StarField />
	<div
		class="absolute bottom-0 left-1/2 aspect-square w-[150%] -translate-x-1/2 translate-y-[62%] rounded-full border border-white/[0.045]"
	></div>
	<div
		class="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(60%_100%_at_50%_120%,rgba(255,255,255,0.05),transparent_70%)]"
	></div>
</div>

<div class="relative flex min-h-full items-center justify-center px-8 py-6">
	<div class="min-h-[572px] w-full max-w-[340px]">
		<div class="flex flex-col items-center">
			<img src="/logo.png" alt="" class="anim-logo h-16 w-auto" />
			<span class="anim-wordmark mt-4 pl-[0.42em] text-[13px] text-muted">ASTRONIDA</span>
			<p class="anim-fade mt-2 text-[13px] text-ink-secondary [animation-delay:0.5s]">
				Голос и текст для своих
			</p>
		</div>

		<form class="mt-8 flex flex-col" onsubmit={handleSubmit}>
			<div class="anim-rise [animation-delay:0.38s]">
				<PillInput
					label="Email"
					type="email"
					autocomplete="email"
					autofocus
					bind:value={email}
					invalid={emailInvalid}
					onblur={() => (emailTouched = true)}
				/>
			</div>

			<div class="collapsible {isRegister ? 'is-open' : ''}" inert={!isRegister}>
				<div>
					<div class="pt-4">
						<PillInput
							label="Никнейм"
							prefix="@"
							autocomplete="username"
							transform={toUsername}
							bind:value={username}
							invalid={usernameInvalid}
						/>
					</div>
				</div>
			</div>

			{#snippet passwordHint()}
				<div in:fade={{ duration: 200 }}>
					<PasswordHint {password} />
				</div>
			{/snippet}

			<div class="anim-rise mt-4 [animation-delay:0.46s]">
				<PillInput
					label="Пароль"
					type="password"
					autocomplete={isRegister ? 'new-password' : 'current-password'}
					bind:value={password}
					invalid={passwordInvalid}
					trailing={isRegister ? passwordHint : undefined}
				/>
			</div>

			<div class="collapsible {isRegister ? 'is-open' : ''}" inert={!isRegister}>
				<div>
					<div class="pt-4">
						<PillInput
							label="Повторите пароль"
							type="password"
							autocomplete="new-password"
							bind:value={passwordRepeat}
							invalid={repeatInvalid}
						/>
					</div>
				</div>
			</div>

			<div class="anim-rise [animation-delay:0.54s]">
				<p
					class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-300 {error
						? 'opacity-100'
						: 'opacity-0'}"
				>
					{error}
				</p>

				<PillButton type="submit" loading={submitting}>
					<span class="grid justify-items-center">
						{#key mode}
							<span
								class="col-start-1 row-start-1"
								in:fade={{ duration: 220, delay: 140 }}
								out:fade={{ duration: 140 }}
							>
								{isRegister ? 'Создать аккаунт' : 'Войти'}
							</span>
						{/key}
					</span>
				</PillButton>

				<div class="collapsible {isRegister ? '' : 'is-open'}" inert={isRegister}>
					<div>
						<div class="flex justify-center pt-4">
							<button
								type="button"
								class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink"
							>
								Забыли пароль?
							</button>
						</div>
					</div>
				</div>
			</div>
		</form>

		<div class="anim-fade mt-6 grid justify-items-center [animation-delay:0.7s]">
			{#key mode}
				<p
					class="col-start-1 row-start-1 text-[13px] text-muted"
					in:fade={{ duration: 220, delay: 140 }}
					out:fade={{ duration: 140 }}
				>
					{isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}
					<button
						type="button"
						class="link-underline font-medium text-ink transition-colors duration-200 hover:text-white"
						onclick={switchMode}
					>
						{isRegister ? 'Войти' : 'Зарегистрироваться'}
					</button>
				</p>
			{/key}
		</div>
	</div>
</div>
