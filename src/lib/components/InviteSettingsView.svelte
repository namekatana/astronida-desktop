<script lang="ts">
	import { generateInviteLink, type InviteLink } from '$lib/servers/invites';
	import Icon from './Icon.svelte';
	import PillButton from './PillButton.svelte';

	interface Props {
		serverId: string;
		onback: () => void;
		oncreated: (invite: InviteLink) => void;
	}

	let { serverId, onback, oncreated }: Props = $props();

	const lifetimes: { value: number | null; label: string }[] = [
		{ value: 1_800, label: '30 минут' },
		{ value: 3_600, label: '1 час' },
		{ value: 21_600, label: '6 часов' },
		{ value: 43_200, label: '12 часов' },
		{ value: 86_400, label: '1 день' },
		{ value: 604_800, label: '7 дней' },
		{ value: null, label: 'Никогда' }
	];

	const useLimits: { value: number | null; label: string }[] = [
		{ value: null, label: 'Без ограничений' },
		{ value: 1, label: '1' },
		{ value: 5, label: '5' },
		{ value: 10, label: '10' },
		{ value: 25, label: '25' },
		{ value: 50, label: '50' },
		{ value: 100, label: '100' }
	];

	let maxAge = $state<number | null>(604_800);
	let maxUses = $state<number | null>(null);
	let submitting = $state(false);
	let error = $state('');

	async function generate() {
		if (submitting) return;
		submitting = true;
		error = '';
		const result = await generateInviteLink(serverId, { maxAge, maxUses });
		submitting = false;
		if (result.ok) oncreated(result.invite);
		else error = result.message;
	}
</script>

{#snippet choices(
	label: string,
	options: { value: number | null; label: string }[],
	selected: number | null,
	onpick: (value: number | null) => void
)}
	<div role="radiogroup" aria-label={label}>
		<p class="text-[13px] font-semibold text-ink">{label}</p>
		<div class="mt-2.5 flex flex-wrap gap-2">
			{#each options as option (option.label)}
				<button
					type="button"
					role="radio"
					aria-checked={selected === option.value}
					disabled={submitting}
					onclick={() => onpick(option.value)}
					class="pressable h-8 rounded-full px-3.5 text-[12px] tabular-nums duration-150 {selected ===
					option.value
						? 'bg-ink font-medium text-bg'
						: 'border border-line text-ink-secondary hover:border-line-strong hover:text-ink'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<div class="relative flex items-center justify-center">
	<button
		type="button"
		aria-label="Назад"
		disabled={submitting}
		onclick={onback}
		class="pressable absolute left-0 flex h-8 w-8 items-center justify-center rounded-full text-muted duration-200 hover:bg-white/[0.06] hover:text-ink"
	>
		<Icon name="chevron" size={16} class="rotate-90" />
	</button>
	<h2 class="text-[15px] font-semibold text-ink">Настройки ссылки</h2>
</div>
<p class="mx-auto mt-1 max-w-[280px] text-center text-[13px] leading-5 text-ink-secondary">
	Новая ссылка не отменит старые — каждая перестанет работать сама
</p>

<div class="mt-6 flex flex-col gap-6">
	{@render choices('Срок действия', lifetimes, maxAge, (value) => (maxAge = value))}
	{@render choices('Максимум использований', useLimits, maxUses, (value) => (maxUses = value))}
</div>

<p
	class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-200 {error
		? 'opacity-100'
		: 'opacity-0'}"
>
	{error}
</p>

<PillButton loading={submitting} onclick={generate}>Создать новую ссылку</PillButton>

<div class="flex justify-center pt-4">
	<button
		type="button"
		disabled={submitting}
		onclick={onback}
		class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink disabled:opacity-60"
	>
		Отмена
	</button>
</div>
