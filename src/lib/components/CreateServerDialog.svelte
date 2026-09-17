<script lang="ts">
	import { validateServerName } from '$lib/servers/servers';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import PillButton from './PillButton.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		serverError?: string;
		submitting?: boolean;
		onsubmit: (name: string) => void;
		onclose: () => void;
	}

	let { serverError = '', submitting = false, onsubmit, onclose }: Props = $props();

	let name = $state('');
	let submitted = $state(false);

	const validationError = $derived(submitted ? validateServerName(name) : '');
	const error = $derived(validationError || serverError);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateServerName(name) || submitting) return;
		onsubmit(name);
	}
</script>

<Dialog label="Новый сервер" locked={submitting} {onclose}>
	<form onsubmit={handleSubmit}>
		<h2 class="text-center text-[15px] font-semibold text-ink">Новый сервер</h2>
		<p class="mt-1 text-center text-[13px] text-ink-secondary">Собери своих на одной орбите</p>

		<div class="mt-7 flex flex-col items-center gap-2">
			<button
				type="button"
				aria-label="Добавить аватар"
				title="Скоро"
				class="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-line text-muted transition-colors duration-200 hover:border-line-strong hover:text-ink"
			>
				<Icon name="camera" size={22} />
			</button>
			<span class="text-[11px] text-muted">Добавить аватар</span>
		</div>

		<div class="mt-6">
			<PillInput label="Название" bind:value={name} invalid={error !== ''} />
		</div>

		<p
			class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-300 {error
				? 'opacity-100'
				: 'opacity-0'}"
		>
			{error}
		</p>

		<PillButton type="submit" loading={submitting}>Создать</PillButton>

		<p class="mt-4 text-center text-[12px] leading-5 text-muted">
			Создавая сервер, вы соглашаетесь с
			<button
				type="button"
				class="link-underline text-ink-secondary transition-colors duration-200 hover:text-ink"
			>
				правилами сообщества
			</button>
			Astronida
		</p>

		<div class="flex justify-center pt-4">
			<button
				type="button"
				disabled={submitting}
				onclick={onclose}
				class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink disabled:opacity-60"
			>
				Отмена
			</button>
		</div>
	</form>
</Dialog>
