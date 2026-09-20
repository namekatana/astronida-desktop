<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { updates } from '$lib/updates/updates.svelte';
	import Icon from './Icon.svelte';

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

	const dateLabel = $derived.by(() => {
		const raw = updates.available?.date;
		if (!raw) return null;
		const parsed = new Date(raw.replace(' ', 'T'));
		return Number.isNaN(parsed.getTime()) ? null : dateFormat.format(parsed);
	});

	$effect(() => {
		if (!open || !root) return;
		return dismissOn(root, () => {
			if (!updates.installing) open = false;
		});
	});
</script>

{#if updates.available}
	<div bind:this={root} class="relative">
		<button
			type="button"
			aria-label="Доступно обновление"
			aria-haspopup="dialog"
			aria-expanded={open}
			onclick={() => (open = !open)}
			class="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 {open
				? 'bg-white/[0.06] text-ink'
				: 'text-muted hover:bg-white/[0.06] hover:text-ink'}"
		>
			<Icon name="download" size={18} />
			<span
				aria-hidden="true"
				class="absolute top-2 right-2 h-2 w-2 rounded-full bg-online ring-2 ring-surface"
			></span>
		</button>

		{#if open}
			<div
				role="dialog"
				aria-label="Обновление"
				in:fly={{ y: -6, duration: 220, easing: (t) => 1 - Math.pow(1 - t, 3) }}
				out:fade={{ duration: 120 }}
				class="panel absolute top-full right-0 z-50 mt-2 w-64 origin-top-right px-4 pt-3.5 pb-4"
			>
				<div class="flex items-baseline justify-between gap-2">
					<div class="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">Обновление</div>
					{#if dateLabel}
						<div class="shrink-0 text-[11px] text-muted">{dateLabel}</div>
					{/if}
				</div>
				<div class="mt-1.5 text-[13px] text-ink">Версия {updates.available.version}</div>
				{#if updates.available.notes}
					<p class="mt-2 line-clamp-4 text-[12px] leading-relaxed text-muted">
						{updates.available.notes}
					</p>
				{/if}

				{#if updates.installing}
					<div class="mt-3.5">
						<div class="flex items-center justify-between text-[11px] text-muted tabular-nums">
							<span>Загрузка</span>
							<span>{updates.progress}%</span>
						</div>
						<div class="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
							<div
								class="h-full rounded-full bg-ink transition-[width] duration-200 ease-out"
								style="width: {updates.progress}%"
							></div>
						</div>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => void updates.install()}
						class="mt-3.5 flex h-9 w-full items-center justify-center rounded-full bg-ink text-[13px] font-medium text-bg transition-colors duration-200 hover:bg-ink-hover active:bg-ink-pressed"
					>
						Обновить и перезапустить
					</button>
					{#if updates.error}
						<div class="mt-2 text-[12px] text-danger">{updates.error}</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
{/if}
