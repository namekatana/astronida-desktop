<script lang="ts">
	import { describeInviteSettings, generateInviteLink, type InviteLink } from '$lib/servers/invites';
	import { settle } from '$lib/ui/settle';
	import SelectMenu from './SelectMenu.svelte';

	interface Props {
		serverId: string;
		oncreated: (invite: InviteLink) => void;
	}

	let { serverId, oncreated }: Props = $props();

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
</script>

<div class="pt-3">
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
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

	<div class="mt-2 grid h-4 grid-cols-1 px-1">
		{#key error || summary}
			<p
				class="col-start-1 row-start-1 truncate text-[12px] leading-4 tabular-nums {error
					? 'text-danger'
					: 'text-ink-secondary'}"
				in:settle
				out:settle={{ duration: 100 }}
			>
				{error || summary}
			</p>
		{/key}
	</div>

	<button
		type="button"
		disabled={submitting}
		aria-busy={submitting}
		onclick={generate}
		class="pressable mt-3 h-10 w-full rounded-full bg-ink text-[13px] font-semibold text-bg duration-150 hover:bg-ink-hover active:bg-ink-pressed disabled:opacity-60"
	>
		Создать ссылку
	</button>
</div>
