<script lang="ts">
	import { describeInviteSettings, generateInviteLink, type InviteLink } from '$lib/servers/invites';
	import PillButton from './PillButton.svelte';
	import SelectMenu from './SelectMenu.svelte';

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

	const summary = $derived(describeInviteSettings({ maxAge, maxUses }, new Date()));

	async function generate() {
		if (submitting) return;
		submitting = true;
		error = '';
		const result = await generateInviteLink(serverId, { maxAge, maxUses });
		submitting = false;
		if (result.ok) oncreated(result.invite);
		else error = result.message;
	}

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<h2 class="text-center text-[15px] font-semibold text-ink">Настройки ссылки</h2>
<p class="mx-auto mt-1 max-w-[280px] text-center text-[13px] leading-5 text-ink-secondary">
	Новая ссылка не отменит старые — каждая перестанет работать сама
</p>

<div
	class="mt-6 overflow-hidden rounded-[14px] border border-surface-line bg-white/[0.03] [corner-shape:squircle]"
>
	<SelectMenu
		label="Срок действия"
		options={lifetimes}
		bind:value={maxAge}
		disabled={submitting}
	/>
	<div class="mx-4 h-px bg-surface-line"></div>
	<SelectMenu
		label="Максимум использований"
		options={useLimits}
		bind:value={maxUses}
		disabled={submitting}
	/>
</div>

<div class="mt-3 grid h-5 grid-cols-1 justify-items-center">
	{#key summary}
		<p
			class="col-start-1 row-start-1 text-center text-[12px] leading-5 text-muted tabular-nums"
			in:settle
			out:settle={{ duration: 100 }}
		>
			{summary}
		</p>
	{/key}
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
