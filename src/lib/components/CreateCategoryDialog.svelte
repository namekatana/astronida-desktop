<script lang="ts">
	import { validateName } from '$lib/channels/channels';
	import Dialog from './Dialog.svelte';
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

	const validationError = $derived(submitted ? validateName(name) : '');
	const error = $derived(validationError || serverError);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateName(name) || submitting) return;
		onsubmit(name);
	}
</script>

<Dialog label="Новая категория" locked={submitting} {onclose}>
	<form onsubmit={handleSubmit}>
		<h2 class="text-center text-[15px] font-semibold text-ink">Новая категория</h2>
		<p class="mt-1 text-center text-[13px] text-ink-secondary">Придумай имя для категории</p>

		<div class="mt-7">
			<PillInput label="Название" bind:value={name} invalid={error !== ''} />
		</div>

		<p
			class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-300 {error
				? 'opacity-100'
				: 'opacity-0'}"
		>
			{error}
		</p>

		<PillButton type="submit" loading={submitting}>Создать категорию</PillButton>

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
