<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import { settle } from '$lib/ui/settle';
	import { updates } from '$lib/updates/updates.svelte';
	import Icon from './Icon.svelte';
	import SheetHeader from './SheetHeader.svelte';

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
			class="pressable relative flex h-10 w-10 items-center justify-center rounded-full duration-200 {open
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
				in:pop={{ y: -4, duration: 180 }}
				out:fade={{ duration: 100 }}
				class="panel panel-floating absolute top-full right-0 z-50 mt-2 w-[300px] origin-top-right pb-4"
			>
				<SheetHeader
					title="Обновление"
					subtitle={dateLabel
						? `Версия ${updates.available.version} · ${dateLabel}`
						: `Версия ${updates.available.version}`}
				/>

				<div class="px-4">
					{#if updates.available.notes}
						<div class="rounded-[14px] bg-white/[0.05] px-4 py-3 [corner-shape:squircle]">
							<p class="line-clamp-6 text-[13px] leading-5 text-ink-secondary">
								{updates.available.notes}
							</p>
						</div>
					{/if}

					<div class="mt-2 grid h-4 grid-cols-1 px-1">
						{#key updates.installing ? 'progress' : (updates.error ?? 'hint')}
							<p
								class="col-start-1 row-start-1 truncate text-[12px] leading-4 tabular-nums {updates.error &&
								!updates.installing
									? 'text-danger'
									: 'text-ink-secondary'}"
								in:settle
								out:settle={{ duration: 100 }}
							>
								{#if updates.installing}
									Загрузка · {updates.progress}%
								{:else}
									{updates.error ?? 'Приложение перезапустится само'}
								{/if}
							</p>
						{/key}
					</div>

					<button
						type="button"
						disabled={updates.installing}
						aria-busy={updates.installing}
						onclick={() => void updates.install()}
						class="pressable relative mt-3 h-10 w-full overflow-hidden rounded-full bg-ink text-[13px] font-semibold text-bg duration-150 hover:bg-ink-hover active:bg-ink-pressed disabled:hover:bg-ink"
					>
						{#if updates.installing}
							<span
								aria-hidden="true"
								class="absolute inset-0 origin-left bg-black/10 transition-[scale] duration-200 ease-out"
								style="scale: {updates.progress / 100} 1"
							></span>
						{/if}
						<span class="relative">
							{updates.installing ? 'Загружается…' : 'Обновить и перезапустить'}
						</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
