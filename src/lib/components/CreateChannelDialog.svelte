<script lang="ts">
	import {
		createChannel,
		validateName,
		type Category,
		type Channel,
		type ChannelKind
	} from '$lib/channels/channels';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import PillButton from './PillButton.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		serverId: string;
		initialKind: ChannelKind;
		categories: Category[];
		oncreated: (channel: Channel) => void;
		onclose: () => void;
	}

	let { serverId, initialKind, categories, oncreated, onclose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let kind = $state<ChannelKind>(initialKind);
	let name = $state('');
	let categoryId = $state<string | null>(null);
	let submitted = $state(false);
	let submitting = $state(false);
	let serverError = $state('');

	const validationError = $derived(submitted ? validateName(name) : '');
	const error = $derived(validationError || serverError);

	const kinds: { kind: ChannelKind; label: string }[] = [
		{ kind: 'text', label: 'Текстовый' },
		{ kind: 'voice', label: 'Голосовой' }
	];

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateName(name) || submitting) return;
		submitting = true;
		serverError = '';
		const result = await createChannel({ serverId, categoryId, name, kind });
		submitting = false;
		if (!result.ok) {
			serverError = result.message;
			return;
		}
		oncreated(result.value);
	}
</script>

<Dialog label="Новый канал" locked={submitting} {onclose}>
	<form onsubmit={handleSubmit}>
		<h2 class="text-center text-[15px] font-semibold text-ink">Новый канал</h2>
		<p class="mt-1 text-center text-[13px] text-ink-secondary">Как назовём канал?</p>

		<div class="relative mt-7 grid h-10 grid-cols-2 rounded-full border border-line p-1">
			<span
				aria-hidden="true"
				class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-200 ease-move {kind ===
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
					class="relative flex items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors duration-200 ease-move {active
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
			class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-200 {error
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
