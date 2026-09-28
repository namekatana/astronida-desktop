<script lang="ts">
	import { createCategory, validateName, type Category } from '$lib/channels/channels';
	import Dialog from './Dialog.svelte';
	import PillButton from './PillButton.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		serverId: string;
		oncreated: (category: Category) => void;
		onclose: () => void;
	}

	let { serverId, oncreated, onclose }: Props = $props();

	let name = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let serverError = $state('');

	const validationError = $derived(submitted ? validateName(name) : '');
	const error = $derived(validationError || serverError);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateName(name) || submitting) return;
		submitting = true;
		serverError = '';
		const result = await createCategory(serverId, name);
		submitting = false;
		if (!result.ok) {
			serverError = result.message;
			return;
		}
		oncreated(result.value);
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
			class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-200 {error
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
