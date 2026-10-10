<script lang="ts">
	import { version } from '../../../package.json';
	import { launchOptions, type SystemToggleId } from '$lib/settings/system';
	import LockedAction from './LockedAction.svelte';
	import LockMark from './LockMark.svelte';

	interface Props {
		toggles: Record<SystemToggleId, boolean>;
	}

	let { toggles = $bindable() }: Props = $props();
</script>

<section aria-labelledby="system-launch">
	<h4 id="system-launch" class="px-1 pb-2 text-[13px] font-semibold text-muted">Запуск</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		{#each launchOptions as option, index (option.id)}
			{#if index > 0}
				{@render divider()}
			{/if}
			{@render checkbox(option.id, option.label, option.description)}
		{/each}
	</div>
</section>

<section aria-labelledby="system-updates" class="mt-6">
	<h4 id="system-updates" class="px-1 pb-2 text-[13px] font-semibold text-muted">Обновления</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-[14px] leading-5 text-ink">Astronida {version}</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">Текущая версия</p>
			</div>
			{@render action('Проверить')}
		</div>
		{@render divider()}
		{@render checkbox('autoUpdate', 'Устанавливать автоматически', 'При следующем запуске')}
	</div>
</section>

<section aria-labelledby="system-storage" class="mt-6">
	<h4 id="system-storage" class="px-1 pb-2 text-[13px] font-semibold text-muted">Хранилище</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1 opacity-40">
				<p class="truncate text-[14px] leading-5 text-ink">Кэш фото</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
					Фото, сохранённые на этом компьютере
				</p>
			</div>
			{@render action('Очистить')}
		</div>
	</div>
	<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
		Фото останутся в чатах и загрузятся снова при просмотре
	</p>
</section>

{#snippet checkbox(id: SystemToggleId, label: string, description?: string)}
	<div
		role="checkbox"
		aria-checked={toggles[id]}
		aria-disabled="true"
		class="flex w-full items-center gap-3 px-4 py-2.5 {description
			? 'min-h-[60px]'
			: 'min-h-[52px]'}"
	>
		<span class="min-w-0 flex-1 opacity-40">
			<span class="block truncate text-[14px] leading-5 text-ink">{label}</span>
			{#if description}
				<span class="mt-0.5 block truncate text-[12px] leading-4 text-muted">{description}</span>
			{/if}
		</span>
		<LockMark />
	</div>
{/snippet}

{#snippet action(label: string)}
	<LockedAction {label} />
{/snippet}

{#snippet divider()}
	<div class="ml-4 h-px bg-white/[0.06]"></div>
{/snippet}
