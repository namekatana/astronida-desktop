<script lang="ts">
	import type { SafetyToggleId } from '$lib/settings/safety';
	import LockedAction from './LockedAction.svelte';
	import LockMark from './LockMark.svelte';

	interface Props {
		toggles: Record<SafetyToggleId, boolean>;
	}

	let { toggles = $bindable() }: Props = $props();
</script>

<section aria-labelledby="safety-lock">
	<h4 id="safety-lock" class="px-1 pb-2 text-[13px] font-semibold text-muted">
		Защита приложения
	</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1 opacity-40">
				<p class="truncate text-[14px] leading-5 text-ink">Код-пароль</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
					Запрашивать при запуске и после бездействия
				</p>
			</div>
			<LockedAction label="Включить" />
		</div>
		{@render divider()}
		{@render checkbox(
			'screenCaptureProtection',
			'Защита от снимков экрана',
			'Окно будет чёрным на скриншотах и записях экрана'
		)}
	</div>
</section>

<section aria-labelledby="safety-sign-in" class="mt-6">
	<h4 id="safety-sign-in" class="px-1 pb-2 text-[13px] font-semibold text-muted">Вход</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		{@render checkbox(
			'newDeviceAlert',
			'Сообщать о входе с нового устройства',
			'Уведомление придёт на все ваши устройства'
		)}
	</div>
</section>

<section aria-labelledby="safety-content" class="mt-6">
	<h4 id="safety-content" class="px-1 pb-2 text-[13px] font-semibold text-muted">Контент</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		{@render checkbox('blurAdultMedia', 'Размывать фото 18+', 'Откроется по нажатию')}
		{@render divider()}
		{@render checkbox(
			'linkWarning',
			'Предупреждать перед открытием ссылок',
			'Показывать адрес сайта перед переходом'
		)}
	</div>
</section>

{#snippet checkbox(id: SafetyToggleId, label: string, description: string)}
	<div
		role="checkbox"
		aria-checked={toggles[id]}
		aria-disabled="true"
		class="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5"
	>
		<span class="min-w-0 flex-1 opacity-40">
			<span class="block truncate text-[14px] leading-5 text-ink">{label}</span>
			<span class="mt-0.5 block truncate text-[12px] leading-4 text-muted">{description}</span>
		</span>
		<LockMark />
	</div>
{/snippet}

{#snippet divider()}
	<div class="ml-4 h-px bg-white/[0.06]"></div>
{/snippet}
