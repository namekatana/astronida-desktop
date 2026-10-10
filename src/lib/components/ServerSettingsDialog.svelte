<script lang="ts">
	import { untrack } from 'svelte';
	import { on } from 'svelte/events';
	import { fade } from 'svelte/transition';
	import type { ServerInvite } from '$lib/servers/invites';
	import { createServerInvites } from '$lib/servers/server-invites.svelte';
	import {
		rememberedServerSection,
		rememberServerSection,
		serverSettingsGroups,
		serverSettingsSection,
		type ServerSettingsSectionId
	} from '$lib/servers/server-settings';
	import type { Server } from '$lib/servers/servers';
	import { initials } from '$lib/ui/initials';
	import { pop } from '$lib/ui/pop';
	import { settle } from '$lib/ui/settle';
	import ConstellationMark from './ConstellationMark.svelte';
	import Icon from './Icon.svelte';
	import LockMark from './LockMark.svelte';
	import RevokeInviteDialog from './RevokeInviteDialog.svelte';
	import ServerBanner from './ServerBanner.svelte';
	import ServerBansSettings from './ServerBansSettings.svelte';
	import ServerInviteJoiners from './ServerInviteJoiners.svelte';
	import ServerInvitesSettings from './ServerInvitesSettings.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		server: Server;
		onclose: () => void;
	}

	let { server, onclose }: Props = $props();

	let selected = $state<ServerSettingsSectionId>(rememberedServerSection());
	let openedInvite = $state<ServerInvite | null>(null);
	let revoking = $state<ServerInvite | null>(null);

	const invites = createServerInvites(untrack(() => server.id));
	const section = $derived(serverSettingsSection(selected));
	const title = $derived(openedInvite ? 'Вступили по ссылке' : section.label);
	const pageKey = $derived(`${selected}:${openedInvite?.code ?? ''}`);

	function select(id: ServerSettingsSectionId) {
		selected = id;
		openedInvite = null;
		rememberServerSection(id);
	}

	$effect(() => {
		if (selected !== 'invites' || openedInvite) return;
		untrack(() => invites.load());
	});

	$effect(() => {
		return on(document, 'keydown', (event) => {
			if (event.key !== 'Escape' || event.defaultPrevented || revoking) return;
			event.preventDefault();
			if (openedInvite) openedInvite = null;
			else onclose();
		});
	});
</script>

<div
	class="absolute inset-0 z-40 flex items-center justify-center bg-bg/70 p-6"
	transition:fade={{ duration: 160 }}
>
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Настройки сервера «{server.name}»"
		in:pop={{ y: 8, duration: 240 }}
		out:fade={{ duration: 120 }}
		class="flex h-[min(620px,100%)] w-[min(900px,100%)] gap-2"
	>
		<nav aria-label="Разделы настроек сервера" class="panel panel-floating flex w-[232px] shrink-0 flex-col">
			<div class="px-2 pt-2">
				<ServerBanner />
			</div>
			<div class="px-5 pb-4">
				<div
					aria-hidden="true"
					class="relative -mt-6 grid size-12 place-items-center rounded-full bg-surface-raised text-[15px] font-semibold text-ink ring-4 ring-surface"
				>
					{initials(server.name)}
				</div>
				<h2 class="mt-2.5 truncate text-[20px] leading-6 font-bold tracking-[-0.01em] text-ink">
					{server.name}
				</h2>
				<p class="mt-0.5 text-[12px] leading-4 text-muted">Настройки сервера</p>
			</div>

			<SmoothScroll scrollbar class="min-h-0 flex-1" contentClass="flex flex-col px-2.5 pb-3">
				{#each serverSettingsGroups as group, groupIndex (groupIndex)}
					{#if groupIndex > 0}
						<div class="mx-2.5 my-2 h-px bg-surface-line"></div>
					{/if}
					<div class="flex flex-col gap-0.5">
						{#each group as item (item.id)}
							{@const active = item.id === selected}
							<button
								type="button"
								aria-current={active ? 'page' : undefined}
								onclick={() => select(item.id)}
								class="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] transition-colors duration-150 {active
									? 'bg-white/[0.08] text-ink'
									: 'text-ink-secondary hover:bg-white/[0.04] hover:text-ink'}"
							>
								<Icon
									name={item.icon}
									size={16}
									class="{active ? 'text-ink' : 'text-muted'} {item.locked ? 'opacity-50' : ''}"
								/>
								<span class="min-w-0 flex-1 truncate {item.locked ? 'opacity-50' : ''}">
									{item.label}
								</span>
								{#if item.locked}
									<LockMark size={12} />
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			</SmoothScroll>
		</nav>

		<section aria-label={title} class="panel panel-floating flex min-w-0 flex-1 flex-col">
			<header class="flex items-center pt-3 pr-3 pb-2 pl-3">
				<div
					inert={!openedInvite}
					class="flex shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-soft motion-reduce:transition-[opacity] {openedInvite
						? 'w-10 opacity-100'
						: 'w-3 opacity-0'}"
				>
					<button
						type="button"
						aria-label="Назад"
						onclick={() => (openedInvite = null)}
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
					aria-label="Закрыть настройки сервера"
					onclick={onclose}
					class="pressable ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.06] hover:text-ink"
				>
					<Icon name="close" size={14} />
				</button>
			</header>
			<div class="mx-4 h-px bg-surface-line"></div>

			<SmoothScroll scrollbar class="min-h-0 flex-1" contentClass="grid grid-cols-1 px-6 py-5">
				{#key pageKey}
					<div in:settle out:settle={{ duration: 100 }} class="col-start-1 row-start-1">
						{#if section.locked}
							<div class="flex min-h-[360px] flex-col items-center justify-center text-center">
								{#if section.constellation}
									<ConstellationMark name={section.constellation} />
								{/if}
								<p class="mt-5 text-[15px] leading-5 font-semibold text-ink">{section.label}</p>
								<p class="mt-1 max-w-[280px] text-[13px] leading-[18px] text-muted">
									{section.summary}
								</p>
								<span
									class="mt-4 flex h-7 items-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-[12px] font-semibold text-muted"
								>
									<Icon name="lock" size={12} />
									Скоро
								</span>
							</div>
						{:else if selected === 'invites' && openedInvite}
							<ServerInviteJoiners serverId={server.id} invite={openedInvite} />
						{:else if selected === 'invites'}
							<ServerInvitesSettings
								{invites}
								onopen={(invite) => (openedInvite = invite)}
								onrevoke={(invite) => (revoking = invite)}
							/>
						{:else}
							<ServerBansSettings serverId={server.id} />
						{/if}
					</div>
				{/key}
			</SmoothScroll>
		</section>
	</div>

	{#if revoking}
		{@const invite = revoking}
		<RevokeInviteDialog
			{invite}
			onconfirm={() => invites.revoke(invite.code)}
			onclose={() => (revoking = null)}
		/>
	{/if}
</div>
