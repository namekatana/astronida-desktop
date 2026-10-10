<script lang="ts">
	import { on } from 'svelte/events';
	import { version } from '../../../package.json';
	import { fade } from 'svelte/transition';
	import {
		categoryLabel,
		rememberCategory,
		rememberedCategory,
		settingsGroups,
		type SettingsCategoryId
	} from '$lib/settings/categories';
	import {
		defaultAudiences,
		defaultDeletionPeriod,
		privacyPageTitle,
		type DeletionPeriod,
		type PrivacyPageId
	} from '$lib/settings/privacy';
	import { defaultNotificationSettings } from '$lib/settings/notifications';
	import { defaultSafetyToggles } from '$lib/settings/safety';
	import { createSectionSpy, type SettingsSection } from '$lib/settings/section-spy.svelte';
	import { defaultSystemToggles } from '$lib/settings/system';
	import { defaultVoiceVideoPreferences } from '$lib/settings/voice';
	import { pop } from '$lib/ui/pop';
	import { settle } from '$lib/ui/settle';
	import type { SmoothScrollController } from '$lib/ui/smooth-scroll';
	import AccountSettings from './AccountSettings.svelte';
	import Icon from './Icon.svelte';
	import LockMark from './LockMark.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import PrivacySettings from './PrivacySettings.svelte';
	import SafetySettings from './SafetySettings.svelte';
	import SearchField from './SearchField.svelte';
	import SessionsSettings from './SessionsSettings.svelte';
	import SmoothScroll from './SmoothScroll.svelte';
	import SystemSettings from './SystemSettings.svelte';
	import VoiceVideoSettings from './VoiceVideoSettings.svelte';

	interface Props {
		username: string | null;
		email: string | null;
		phone: string | null;
		createdAt: string | null;
		signingOut: boolean;
		onsignout: () => void;
		onclose: () => void;
	}

	let { username, email, phone, createdAt, signingOut, onsignout, onclose }: Props = $props();

	let selected = $state<SettingsCategoryId>(rememberedCategory());
	let query = $state('');
	let privacyItem = $state<PrivacyPageId | null>(null);
	let privacyAudiences = $state({ ...defaultAudiences });
	let deletionPeriod = $state<DeletionPeriod>(defaultDeletionPeriod);
	let notificationSettings = $state({ ...defaultNotificationSettings });
	let safetyToggles = $state({ ...defaultSafetyToggles });
	let voicePreferences = $state(defaultVoiceVideoPreferences());
	let systemToggles = $state({ ...defaultSystemToggles });
	let accountPage = $state<'sessions' | null>(null);
	let pageScroll = $state<SmoothScrollController>();
	let pageViewport = $state<HTMLDivElement>();
	let knownSections = $state<Partial<Record<SettingsCategoryId, SettingsSection[]>>>({});

	const sectionSpy = createSectionSpy();
	const sectionRowHeight = 32;

	const subpage = $derived(
		selected === 'privacy' ? privacyItem : selected === 'account' ? accountPage : null
	);
	const pageKey = $derived(`${selected}:${subpage}`);
	const activeSection = $derived(Math.round(sectionSpy.progress));

	$effect(() => {
		if (subpage || !pageViewport) return;
		const page = pageViewport.querySelector<HTMLElement>(`[data-settings-page="${pageKey}"]`);
		if (!page) return;
		const category = selected;
		const { sections, detach } = sectionSpy.attach(page, pageViewport, pageScroll);
		knownSections[category] = sections;
		return detach;
	});
	const title = $derived.by(() => {
		if (selected === 'privacy' && privacyItem) return privacyPageTitle(privacyItem);
		if (selected === 'account' && accountPage) return 'Активные сеансы';
		return categoryLabel(selected);
	});

	$effect(() => {
		return on(document, 'keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			if (subpage) closeSubpage();
			else onclose();
		});
	});

	function select(id: SettingsCategoryId) {
		selected = id;
		closeSubpage();
		rememberCategory(id);
	}

	function closeSubpage() {
		privacyItem = null;
		accountPage = null;
	}

	function leavePage(_node: Element) {
		const offset = pageScroll?.position ?? 0;
		pageScroll?.scrollTo(0, { instant: true });
		return {
			duration: 100,
			css: (t: number) =>
				`opacity: ${t}; filter: blur(${(1 - t) * 2}px); transform: translateY(${-offset}px)`
		};
	}
</script>

<div
	class="absolute inset-0 z-40 flex items-center justify-center bg-bg/70 p-6"
	transition:fade={{ duration: 160 }}
>
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Настройки"
		in:pop={{ y: 8, duration: 240 }}
		out:fade={{ duration: 120 }}
		class="flex h-[min(620px,100%)] w-[min(900px,100%)] gap-2"
	>
		<nav aria-label="Разделы настроек" class="panel panel-floating flex w-[232px] shrink-0 flex-col">
			<h2 class="px-5 pt-4 pb-3 text-[20px] leading-6 font-bold tracking-[-0.01em] text-ink">
				Настройки
			</h2>
			<div class="relative px-3 pb-2">
				<div inert class="opacity-40">
					<SearchField bind:value={query} placeholder="Поиск настроек" />
				</div>
				<LockMark size={12} class="absolute top-3 right-6" />
			</div>
			<SmoothScroll scrollbar class="min-h-0 flex-1" contentClass="flex flex-col px-2.5 pb-3">
				{#each settingsGroups as group, groupIndex (groupIndex)}
					{#if groupIndex > 0}
						<div class="mx-2.5 my-2 h-px bg-surface-line"></div>
					{/if}
					<div class="flex flex-col gap-0.5">
						{#each group as category (category.id)}
							{@const active = category.id === selected}
							{@const sections = knownSections[category.id] ?? []}
							{@const expanded = active && !subpage && sections.length > 0}
							<div>
								<button
									type="button"
									aria-current={active ? 'page' : undefined}
									onclick={() => select(category.id)}
									class="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] transition-colors duration-150 {active
										? 'bg-white/[0.08] text-ink'
										: 'text-ink-secondary hover:bg-white/[0.04] hover:text-ink'}"
								>
									<Icon
										name={category.icon}
										size={16}
										class="{active ? 'text-ink' : 'text-muted'} {category.locked ? 'opacity-50' : ''}"
									/>
									<span class="min-w-0 flex-1 truncate {category.locked ? 'opacity-50' : ''}">
										{category.label}
									</span>
									{#if category.locked}
										<LockMark size={12} />
									{/if}
								</button>
								<div class="collapsible {expanded ? 'is-open' : ''}" inert={!expanded}>
									<div>
										<div class="relative mt-0.5 mb-1 ml-[18px] border-l border-white/[0.08]">
											{#if expanded}
												<span
													aria-hidden="true"
													class="absolute top-1.5 -left-px h-5 w-0.5 rounded-full bg-ink {sectionSpy.scrollable
														? ''
														: 'transition-transform duration-200 ease-soft'}"
													style="transform: translateY({sectionSpy.progress * sectionRowHeight}px)"
												></span>
											{/if}
											{#each sections as section, index (section.id)}
												<button
													type="button"
													aria-current={expanded && index === activeSection ? 'location' : undefined}
													onclick={() => sectionSpy.scrollTo(index)}
													class="flex h-8 w-full items-center pr-2 pl-3.5 text-left text-[13px] transition-colors duration-150 {expanded &&
													index === activeSection
														? 'text-ink'
														: 'text-muted hover:text-ink-secondary'}"
												>
													<span class="min-w-0 flex-1 truncate">{section.title}</span>
												</button>
											{/each}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</SmoothScroll>
			<p class="px-5 pb-4 text-[11px] text-muted">Astronida {version}</p>
		</nav>

		<section aria-label={title} class="panel panel-floating flex min-w-0 flex-1 flex-col">
			<header class="flex items-center pt-3 pr-3 pb-2 pl-3">
				<div
					inert={!subpage}
					class="flex shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-soft motion-reduce:transition-[opacity] {subpage
						? 'w-10 opacity-100'
						: 'w-3 opacity-0'}"
				>
					<button
						type="button"
						aria-label="Назад"
						onclick={closeSubpage}
						class="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.06] hover:text-ink"
					>
						<Icon name="chevron" size={16} class="rotate-90" />
					</button>
				</div>
				<div class="grid min-w-0 flex-1 grid-cols-1">
					{#key title}
						<h3
							in:settle
							out:settle={{ duration: 100 }}
							class="col-start-1 row-start-1 truncate text-[20px] leading-8 font-bold tracking-[-0.01em] text-ink"
						>
							{title}
						</h3>
					{/key}
				</div>
				<button
					type="button"
					aria-label="Закрыть настройки"
					onclick={onclose}
					class="pressable ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.06] hover:text-ink"
				>
					<Icon name="close" size={14} />
				</button>
			</header>
			<div class="mx-4 h-px bg-surface-line"></div>
			<SmoothScroll
				scrollbar
				bind:controller={pageScroll}
				bind:viewport={pageViewport}
				class="min-h-0 flex-1"
				contentClass="grid grid-cols-1 px-6 py-5"
			>
				{#key pageKey}
					<div in:settle out:leavePage data-settings-page={pageKey} class="col-start-1 row-start-1">
						{#if selected === 'account' && accountPage === 'sessions'}
							<SessionsSettings />
						{:else if selected === 'account'}
							<AccountSettings
								{username}
								{email}
								{phone}
								{createdAt}
								{signingOut}
								{onsignout}
								onopensessions={() => (accountPage = 'sessions')}
							/>
						{:else if selected === 'privacy'}
							<PrivacySettings
								opened={privacyItem}
								bind:audiences={privacyAudiences}
								bind:deletionPeriod
								onopen={(id) => (privacyItem = id)}
							/>
						{:else if selected === 'safety'}
							<SafetySettings bind:toggles={safetyToggles} />
						{:else if selected === 'notifications'}
							<NotificationSettings bind:settings={notificationSettings} />
						{:else if selected === 'voice'}
							<VoiceVideoSettings bind:preferences={voicePreferences} />
						{:else if selected === 'system'}
							<SystemSettings bind:toggles={systemToggles} />
						{/if}
					</div>
				{/key}
			</SmoothScroll>
		</section>
	</div>
</div>
