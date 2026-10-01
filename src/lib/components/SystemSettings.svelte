<script lang="ts">
	import { version } from '../../../package.json';
	import { launchOptions, type SystemToggleId } from '$lib/settings/system';
	import CheckCircle from './CheckCircle.svelte';

	interface Props {
		toggles: Record<SystemToggleId, boolean>;
	}

	let { toggles = $bindable() }: Props = $props();

	function toggle(id: SystemToggleId) {
		toggles = { ...toggles, [id]: !toggles[id] };
	}
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
			<div class="min-w-0 flex-1">
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
	{@const checked = toggles[id]}
	<button
		type="button"
		role="checkbox"
		aria-checked={checked}
		onclick={() => toggle(id)}
		class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.03] {description
			? 'min-h-[60px]'
			: 'min-h-[52px]'}"
	>
		<span class="min-w-0 flex-1">
			<span
				class="block truncate text-[14px] leading-5 transition-colors duration-150 {checked
					? 'text-ink'
					: 'text-ink-secondary'}"
			>
				{label}
			</span>
			{#if description}
				<span class="mt-0.5 block truncate text-[12px] leading-4 text-muted">{description}</span>
			{/if}
		</span>
		<CheckCircle {checked} />
	</button>
{/snippet}

{#snippet action(label: string)}
	<button
		type="button"
		class="pressable h-8 shrink-0 rounded-full bg-white/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12]"
	>
		{label}
	</button>
{/snippet}

{#snippet divider()}
	<div class="ml-4 h-px bg-white/[0.06]"></div>
{/snippet}
