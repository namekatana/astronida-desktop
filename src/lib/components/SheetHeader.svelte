<script lang="ts">
	import type { Snippet } from 'svelte';
	import { settle } from '$lib/ui/settle';
	import DrawnCheck from './DrawnCheck.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		title: string;
		subtitle?: string | null;
		subtitleDanger?: boolean;
		cancelLabel?: string;
		cancelDisabled?: boolean;
		oncancel?: () => void;
		actionLabel?: string;
		actionDisabled?: boolean;
		actionBusy?: boolean;
		actionDone?: boolean;
		actionForm?: string;
		onaction?: () => void;
		trailing?: Snippet;
	}

	let {
		title,
		subtitle,
		subtitleDanger = false,
		cancelLabel,
		cancelDisabled = false,
		oncancel,
		actionLabel,
		actionDisabled = false,
		actionBusy = false,
		actionDone = false,
		actionForm,
		onaction,
		trailing
	}: Props = $props();

	const reservesSubtitle = $derived(subtitle !== undefined);
	const actionInactive = $derived(actionDisabled || actionBusy || actionDone);
</script>

<header class="flex h-14 items-center px-5">
	<div class="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,1fr)] items-center gap-x-3">
		<div class="col-start-1 row-start-1 flex h-5 items-center justify-start">
			{#if cancelLabel}
				<button
					type="button"
					disabled={cancelDisabled}
					onclick={oncancel}
					class="flex h-5 items-center text-[14px] leading-5 text-ink-secondary transition-[color,opacity] duration-150 hover:text-ink active:opacity-60 disabled:opacity-40"
				>
					{cancelLabel}
				</button>
			{/if}
		</div>

		<div class="col-start-2 row-start-1 grid min-w-0">
			{#key title}
				<h2
					class="col-start-1 row-start-1 truncate text-center text-[15px] leading-5 font-semibold text-ink"
					in:settle
					out:settle={{ duration: 100 }}
				>
					{title}
				</h2>
			{/key}
		</div>

		{#if reservesSubtitle}
			<div class="col-start-2 row-start-2 grid h-4 min-w-0 grid-cols-1 justify-items-center">
				{#key `${subtitleDanger}:${subtitle ?? ''}`}
					{#if subtitle}
						<p
							class="col-start-1 row-start-1 max-w-full truncate text-[12px] leading-4 tabular-nums {subtitleDanger
								? 'text-danger'
								: 'text-muted'}"
							in:settle
							out:settle={{ duration: 100 }}
						>
							{subtitle}
						</p>
					{/if}
				{/key}
			</div>
		{/if}

		<div class="col-start-3 row-start-1 flex h-5 items-center justify-end">
			{#if trailing}
				{@render trailing()}
			{:else if actionLabel}
				<button
					type={actionForm ? 'submit' : 'button'}
					form={actionForm}
					disabled={actionInactive}
					aria-busy={actionBusy}
					onclick={actionForm ? undefined : onaction}
					class="grid h-5 items-center text-[14px] leading-5 font-semibold transition-[color,opacity] duration-200 ease-soft active:opacity-60 {actionDisabled
						? 'text-muted'
						: 'text-ink'}"
				>
					{#key actionDone ? 'done' : actionBusy ? 'busy' : actionLabel}
						<span
							class="col-start-1 row-start-1 flex h-5 items-center justify-end gap-1.5 whitespace-nowrap"
							in:settle
							out:settle={{ duration: 100 }}
						>
							{#if actionDone}
								<DrawnCheck size={14} delay={60} />
								Готово
							{:else if actionBusy}
								<Orbit size={16} />
							{:else}
								{actionLabel}
							{/if}
						</span>
					{/key}
				</button>
			{/if}
		</div>
	</div>
</header>
