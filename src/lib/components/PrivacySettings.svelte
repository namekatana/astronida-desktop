<script lang="ts">
	import {
		audienceLabel,
		audienceNote,
		dataPageLabels,
		deletionPeriodLabel,
		deletionPeriods,
		exceptionsFor,
		privacyItemOf,
		privacySections,
		type DeletionPeriod,
		type PrivacyAudience,
		type PrivacyItemId,
		type PrivacyPageId
	} from '$lib/settings/privacy';
	import { reveal } from '$lib/ui/reveal';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import LockMark from './LockMark.svelte';

	interface Props {
		opened: PrivacyPageId | null;
		audiences: Record<PrivacyItemId, PrivacyAudience>;
		deletionPeriod: DeletionPeriod;
		onopen: (id: PrivacyPageId) => void;
	}

	let { opened, audiences = $bindable(), deletionPeriod = $bindable(), onopen }: Props = $props();

	function choose(id: PrivacyItemId, audience: PrivacyAudience) {
		audiences = { ...audiences, [id]: audience };
	}
</script>

{#if opened === 'blocked'}
	<section aria-labelledby="privacy-blocked">
		<h4 id="privacy-blocked" class="px-1 pb-2 text-[13px] font-semibold text-muted">
			Заблокированные пользователи
		</h4>
		<div
			class="flex flex-col items-center rounded-[14px] bg-white/[0.05] px-6 pt-7 pb-6 text-center [corner-shape:squircle]"
		>
			<div class="grid size-10 place-items-center rounded-full bg-white/[0.08] text-ink-secondary">
				<Icon name="user" size={18} />
			</div>
			<p class="mt-3 text-[14px] leading-5 font-semibold text-ink">Пока никого</p>
			<p class="mt-1 text-[12px] leading-4 text-muted">
				Здесь появятся пользователи, которых вы заблокировали
			</p>
			<button
				type="button"
				class="pressable mt-4 h-8 rounded-full bg-white/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12]"
			>
				Заблокировать пользователя
			</button>
		</div>
		<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
			Заблокированные не могут писать вам, отправлять запросы в друзья и видеть ваш статус
		</p>
	</section>
{:else if opened === 'autoDelete'}
	<section aria-labelledby="privacy-auto-delete">
		<h4 id="privacy-auto-delete" class="px-1 pb-2 text-[13px] font-semibold text-muted">
			Удалить учётную запись, если меня не было
		</h4>
		<div
			role="radiogroup"
			aria-labelledby="privacy-auto-delete"
			class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]"
		>
			{#each deletionPeriods as period, index (period.months)}
				{@render choice(index, period.label, period.months === deletionPeriod, () => {
					deletionPeriod = period.months;
				})}
			{/each}
		</div>
		<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
			Если вы не будете заходить дольше этого срока, учётная запись удалится вместе с сообщениями и
			файлами
		</p>
	</section>
{:else if opened}
	{@const item = privacyItemOf(opened)}
	{@const audience = audiences[opened]}
	{@const note = audienceNote(item, audience)}
	<section aria-labelledby="privacy-audience">
		<h4 id="privacy-audience" class="px-1 pb-2 text-[13px] font-semibold text-muted">
			{item.question}
		</h4>
		<div
			role="radiogroup"
			aria-labelledby="privacy-audience"
			class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]"
		>
			{#each item.options as option, index (option)}
				{@render choice(index, audienceLabel(option), option === audience, () =>
					choose(item.id, option)
				)}
			{/each}
		</div>
		<div class="grid grid-cols-1 px-1 pt-2">
			{#key note}
				<p
					in:settle
					out:settle={{ duration: 100 }}
					class="col-start-1 row-start-1 text-[12px] leading-4 text-muted"
				>
					{note}
				</p>
			{/key}
		</div>
	</section>

	<section aria-labelledby="privacy-exceptions" class="mt-6">
		<h4 id="privacy-exceptions" class="px-1 pb-2 text-[13px] font-semibold text-muted">
			Исключения
		</h4>
		<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
			{#each exceptionsFor(audience) as exception, index (index)}
				<div transition:reveal>
					{#if index > 0}
						{@render divider()}
					{/if}
					<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
						<div class="min-w-0 flex-1">
							<div class="grid grid-cols-1">
								{#key exception}
									<p
										in:settle
										out:settle={{ duration: 100 }}
										class="col-start-1 row-start-1 truncate text-[14px] leading-5 text-ink"
									>
										{item.exceptionLabels[exception]}
									</p>
								{/key}
							</div>
							<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">Нет пользователей</p>
						</div>
						<button
							type="button"
							class="pressable h-8 shrink-0 rounded-full bg-white/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12]"
						>
							Добавить
						</button>
					</div>
				</div>
			{/each}
		</div>
		<p class="px-1 pt-2 text-[12px] leading-4 text-muted">Исключения важнее основного правила</p>
	</section>
{:else}
	{#each privacySections as section, sectionIndex (section.id)}
		<section aria-labelledby="privacy-{section.id}" class={sectionIndex > 0 ? 'mt-6' : ''}>
			<h4 id="privacy-{section.id}" class="px-1 pb-2 text-[13px] font-semibold text-muted">
				{section.title}
			</h4>
			<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
				{#each section.items as item, index (item.id)}
					{@render link(index, item.label, audienceLabel(audiences[item.id]))}
				{/each}
			</div>
		</section>
	{/each}

	<section aria-labelledby="privacy-data" class="mt-6">
		<h4 id="privacy-data" class="px-1 pb-2 text-[13px] font-semibold text-muted">
			Блокировки и данные
		</h4>
		<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
			{@render link(0, dataPageLabels.blocked, 'Нет')}
			{@render link(1, dataPageLabels.autoDelete, deletionPeriodLabel(deletionPeriod))}
		</div>
	</section>
{/if}

{#snippet link(index: number, label: string, value: string)}
	{#if index > 0}
		{@render divider()}
	{/if}
	<div aria-disabled="true" class="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5">
		<span class="min-w-0 flex-1 truncate text-[14px] leading-5 text-ink opacity-40">{label}</span>
		<span class="shrink-0 text-[13px] text-muted opacity-40">{value}</span>
		<LockMark />
	</div>
{/snippet}

{#snippet choice(index: number, label: string, checked: boolean, onclick: () => void)}
	{#if index > 0}
		{@render divider()}
	{/if}
	<button
		type="button"
		role="radio"
		aria-checked={checked}
		{onclick}
		class="flex h-11 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-white/[0.03]"
	>
		<span class="min-w-0 flex-1 truncate text-[14px] leading-5 text-ink">{label}</span>
		<Icon
			name="check"
			size={16}
			class="shrink-0 text-ink transition-opacity duration-150 {checked ? 'opacity-100' : 'opacity-0'}"
		/>
	</button>
{/snippet}

{#snippet divider()}
	<div class="ml-4 h-px bg-white/[0.06]"></div>
{/snippet}
