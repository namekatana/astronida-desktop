<script lang="ts">
	import { validateName, type Category, type ChannelKind } from '$lib/channels/channels';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import PillButton from './PillButton.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		initialKind: ChannelKind;
		categories: Category[];
		serverError?: string;
		submitting?: boolean;
		onsubmit: (input: { name: string; kind: ChannelKind; categoryId: string | null }) => void;
		onclose: () => void;
	}

	let {
		initialKind,
		categories,
		serverError = '',
		submitting = false,
		onsubmit,
		onclose
	}: Props = $props();

	// svelte-ignore state_referenced_locally -- нужно именно начальное значение
	let kind = $state<ChannelKind>(initialKind);
	let name = $state('');
	let categoryId = $state<string | null>(null);
	let submitted = $state(false);

	const validationError = $derived(submitted ? validateName(name) : '');
	const error = $derived(validationError || serverError);

	const kinds: { kind: ChannelKind; label: string }[] = [
		{ kind: 'text', label: 'Текстовый' },
		{ kind: 'voice', label: 'Голосовой' }
	];

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateName(name) || submitting) return;
		onsubmit({ name, kind, categoryId });
	}
</script>

<Dialog label="Новый канал" locked={submitting} {onclose}>
	<form onsubmit={handleSubmit}>
		<h2 class="text-center text-[15px] font-semibold text-ink">Новый канал</h2>
		<p class="mt-1 text-center text-[13px] text-ink-secondary">Как назовём канал?</p>

		<div class="relative mt-7 grid h-10 grid-cols-2 rounded-full border border-line p-1">
			<span
				aria-hidden="true"
				class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-300 ease-soft {kind ===
				'voice'
					? 'translate-x-full'
					: ''}"
			></span>
			{#each kinds as option (option.kind)}
				{@const active = kind === option.kind}
				<button
					type="button"
					aria-pressed={active}
					onclick={() => (kind = option.kind)}
					class="relative flex items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors duration-300 {active
						? 'text-bg'
						: 'text-ink-secondary hover:text-ink'}"
				>
					<Icon name={option.kind} />
					{option.label}
				</button>
			{/each}
		</div>

		<div class="mt-6">
			<div class="px-1 text-[11px] font-medium tracking-[0.1em] text-muted uppercase">Категория</div>
			<div class="mt-2.5 flex flex-wrap gap-2">
				{#snippet option(id: string | null, label: string)}
					{@const active = categoryId === id}
					<button
						type="button"
						aria-pressed={active}
						onclick={() => (categoryId = id)}
						class="h-8 max-w-full truncate rounded-full border px-3 text-[13px] transition-colors duration-200 {active
							? 'border-ink bg-ink text-bg'
							: 'border-line text-ink-secondary hover:border-line-strong hover:text-ink'}"
					>
						{label}
					</button>
				{/snippet}

				{@render option(null, 'Без категории')}
				{#each categories as category (category.id)}
					{@render option(category.id, category.name)}
				{/each}
			</div>
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

		<PillButton type="submit" loading={submitting}>Создать канал</PillButton>

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
