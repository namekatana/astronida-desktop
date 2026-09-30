<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { draw } from 'svelte/transition';

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
		onaction
	}: Props = $props();

	const reservesSubtitle = $derived(subtitle !== undefined);
	const actionInactive = $derived(actionDisabled || actionBusy || actionDone);

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<header class="flex h-14 items-center px-5">
	<div class="grid w-full grid-cols-[1fr_minmax(0,220px)_1fr] items-center gap-x-3">
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

		<h2
			class="col-start-2 row-start-1 truncate text-center text-[15px] leading-5 font-semibold text-ink"
		>
			{title}
		</h2>

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
			{#if actionLabel}
				<button
					type={actionForm ? 'submit' : 'button'}
					form={actionForm}
					disabled={actionInactive}
					aria-busy={actionBusy}
					onclick={actionForm ? undefined : onaction}
					class="grid h-5 items-center text-[14px] leading-5 font-semibold transition-[color,opacity] duration-200 ease-soft active:opacity-60 {actionDisabled
						? 'text-muted'
						: 'text-ink'} {actionBusy ? 'opacity-50' : ''}"
				>
					{#key actionDone}
						<span
							class="col-start-1 row-start-1 flex h-5 items-center justify-end gap-1.5"
							in:settle
							out:settle={{ duration: 100 }}
						>
							{#if actionDone}
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path
										d="M3.25 8.5 6.5 11.75 12.75 4.75"
										in:draw={{ duration: prefersReducedMotion.current ? 0 : 280, delay: 60 }}
									/>
								</svg>
								Готово
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
