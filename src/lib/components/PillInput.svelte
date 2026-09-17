<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import Icon from './Icon.svelte';

	interface Props {
		label: string;
		value: string;
		type?: 'text' | 'email' | 'password';
		autocomplete?: 'email' | 'current-password' | 'new-password' | 'username';
		invalid?: boolean;
		prefix?: string;
		transform?: (raw: string) => string;
		trailing?: Snippet;
		autofocus?: boolean;
		onblur?: () => void;
	}

	let {
		label,
		value = $bindable(),
		type = 'text',
		autocomplete,
		invalid = false,
		prefix,
		transform,
		trailing,
		autofocus = false,
		onblur
	}: Props = $props();

	let focused = $state(false);
	let revealed = $state(false);

	const floated = $derived(focused || value.length > 0);

	const isPassword = $derived(type === 'password');
	const inputType = $derived(isPassword && revealed ? 'text' : type);
	const paddingRight = $derived(
		trailing && isPassword ? 'pr-[5.25rem]' : trailing || isPassword ? 'pr-14' : 'pr-6'
	);
</script>

<label class="relative block">
	{#if prefix}
		<span
			class="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-[15px] text-muted"
		>
			{prefix}
		</span>
	{/if}

	<!-- svelte-ignore a11y_autofocus -- единственная форма на экране, фокус в первом поле ожидаем -->
	<input
		type={inputType}
		{value}
		{autocomplete}
		{autofocus}
		spellcheck="false"
		oninput={(event) => {
			const next = transform ? transform(event.currentTarget.value) : event.currentTarget.value;
			// поле контролируемое: без явной записи отвергнутые символы остались бы видны
			event.currentTarget.value = next;
			value = next;
		}}
		onfocus={() => (focused = true)}
		onblur={() => {
			focused = false;
			onblur?.();
		}}
		class="h-14 w-full rounded-full border bg-transparent text-[15px] text-ink outline-none transition-colors duration-200 {prefix
			? 'pl-[2.4rem]'
			: 'pl-6'} {paddingRight} {invalid
			? 'border-danger'
			: focused
				? 'border-line-strong'
				: 'border-line'}"
	/>

	<span
		class="pointer-events-none absolute -translate-y-1/2 px-2 transition-all duration-200 {floated
			? 'top-0 left-5 bg-[var(--pill-surface,var(--color-bg))] text-[11px] tracking-[0.08em]'
			: prefix
				? 'top-1/2 left-[1.9rem] text-[15px]'
				: 'top-1/2 left-5 text-[15px]'} {invalid
			? 'text-danger'
			: focused
				? 'text-accent'
				: 'text-muted'}"
	>
		{label}
	</span>

	{#if trailing || isPassword}
		<span class="absolute inset-y-0 right-4 flex items-center gap-1">
			{#if trailing}
				{@render trailing()}
			{/if}
			{#if isPassword}
				<button
					type="button"
					aria-label={revealed ? 'Скрыть пароль' : 'Показать пароль'}
					aria-pressed={revealed}
					onmousedown={(event) => event.preventDefault()}
					onclick={() => (revealed = !revealed)}
					class="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors duration-200 hover:text-ink"
				>
					{#key revealed}
						<span
							class="col-start-1 row-start-1 flex"
							in:fade={{ duration: 150 }}
							out:fade={{ duration: 150 }}
						>
							<Icon name={revealed ? 'eye-off' : 'eye'} size={18} />
						</span>
					{/key}
				</button>
			{/if}
		</span>
	{/if}
</label>
