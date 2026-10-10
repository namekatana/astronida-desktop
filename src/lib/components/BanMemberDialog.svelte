<script lang="ts">
	import { fade } from 'svelte/transition';
	import {
		banDurations,
		banEndsAt,
		banMember,
		banUntilLabel,
		type BanDuration
	} from '$lib/servers/moderation';
	import type { ModerationTarget } from '$lib/servers/moderation-target';
	import ConfirmButtons from './ConfirmButtons.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import ModerationTargetCard from './ModerationTargetCard.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		serverId: string;
		serverName: string;
		target: ModerationTarget;
		ondone: () => void;
		onclose: () => void;
	}

	let { serverId, serverName, target, ondone, onclose }: Props = $props();

	let duration = $state<BanDuration>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let hoveredIndex = $state<number | null>(null);

	function highlighted(index: number): boolean {
		return hoveredIndex === index || banDurations[index].value === duration;
	}

	const consequence = $derived(
		duration === null
			? 'Не сможет вернуться по приглашению, пока вы его не разблокируете'
			: `Не сможет вернуться по приглашению ${banUntilLabel(banEndsAt(duration, new Date()))}`
	);

	async function confirm() {
		busy = true;
		error = null;
		const result = await banMember(serverId, target.id, duration);
		busy = false;
		if (result.ok) ondone();
		else error = result.message;
	}
</script>

<Dialog label="Заблокировать" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Заблокировать"
		subtitle={error ?? 'Будет удалён с сервера'}
		subtitleDanger={error !== null}
	/>

	<div class="px-4 pb-4">
		<ModerationTargetCard {target} {serverName} />

		<h4 class="px-1 pt-4 pb-2 text-[12px] font-semibold text-muted">Срок</h4>
		<div
			role="radiogroup"
			aria-label="Срок блокировки"
			class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]"
		>
			{#each banDurations as option, index (option.label)}
				{@const selected = option.value === duration}
				{#if index > 0}
					<div
						class="ml-4 h-px transition-colors duration-150 {highlighted(index) ||
						highlighted(index - 1)
							? 'bg-transparent'
							: 'bg-white/[0.06]'}"
					></div>
				{/if}
				<button
					type="button"
					role="radio"
					aria-checked={selected}
					disabled={busy}
					onclick={() => (duration = option.value)}
					onpointerenter={() => (hoveredIndex = index)}
					onpointerleave={() => (hoveredIndex = null)}
					class="flex h-10 w-full items-center gap-3 px-4 text-left text-[14px] transition-colors duration-150 active:bg-white/[0.06] active:duration-0 {selected
						? 'bg-white/[0.04] text-ink'
						: 'text-ink-secondary hover:bg-white/[0.03]'}"
				>
					<span class="min-w-0 flex-1 truncate">{option.label}</span>
					<Icon
						name="check"
						size={14}
						class="text-ink transition-[opacity,scale] duration-[180ms] ease-soft motion-reduce:scale-100 {selected
							? 'scale-100 opacity-100'
							: 'scale-[0.6] opacity-0'}"
					/>
				</button>
			{/each}
		</div>

		<div class="grid h-8 grid-cols-1 px-1 pt-2 box-content">
			{#key consequence}
				<p
					in:fade={{ duration: 120 }}
					out:fade={{ duration: 120 }}
					class="col-start-1 row-start-1 text-[12px] leading-4 text-muted"
				>
					{consequence}
				</p>
			{/key}
		</div>

		<div class="mt-3">
			<ConfirmButtons label="Заблокировать" {busy} onconfirm={confirm} oncancel={onclose} />
		</div>
	</div>
</Dialog>
