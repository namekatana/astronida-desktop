<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ServerInvite } from '$lib/servers/invites';
	import type { ServerInvites } from '$lib/servers/server-invites.svelte';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import { reveal } from '$lib/ui/reveal';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import InviteLinkSummary from './InviteLinkSummary.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		invites: ServerInvites;
		onopen: (invite: ServerInvite) => void;
		onrevoke: (invite: ServerInvite) => void;
	}

	let { invites, onopen, onrevoke }: Props = $props();

	const list = $derived(invites.invites);
	const slowLoading = createDelayedFlag(() => list === null && invites.error === null);
	const heading = $derived(
		invites.error ?? (list === null ? 'Ссылки' : `Ссылки — ${list.length}`)
	);
</script>

<section aria-labelledby="server-invites">
	<div class="grid grid-cols-1 px-1 pb-2">
		{#key heading}
			<h4
				id="server-invites"
				in:settle
				out:settle={{ duration: 100 }}
				class="col-start-1 row-start-1 text-[13px] font-semibold {invites.error
					? 'text-danger'
					: 'text-muted'}"
			>
				{heading}
			</h4>
		{/key}
	</div>

	<div class="grid min-h-[132px] grid-cols-1 rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		{#if list === null}
			{#if slowLoading.current}
				<div class="col-start-1 row-start-1 grid place-items-center" in:fade={{ duration: 150 }}>
					<Orbit size={24} label="Загрузка" class="text-muted" />
				</div>
			{/if}
		{:else if list.length === 0}
			<div
				class="col-start-1 row-start-1 flex flex-col items-center justify-center px-6 py-6 text-center"
				in:fade={{ duration: 150 }}
			>
				<div class="grid size-10 place-items-center rounded-full bg-white/[0.08] text-ink-secondary">
					<Icon name="link" size={18} />
				</div>
				<p class="mt-3 text-[14px] leading-5 font-semibold text-ink">Ссылок нет</p>
				<p class="mt-0.5 text-[12px] leading-4 text-muted">
					Создайте ссылку кнопкой «Пригласить» рядом с названием сервера
				</p>
			</div>
		{:else}
			<ul class="col-start-1 row-start-1 flex flex-col self-start" in:fade={{ duration: 150 }}>
				{#each list as invite, index (invite.code)}
					<li transition:reveal>
						{#if index > 0}
							<div class="ml-[60px] h-px bg-white/[0.06]"></div>
						{/if}
						<div class="flex min-h-[60px] items-center gap-2 py-1.5 pr-4 pl-2">
							<button
								type="button"
								onclick={() => onopen(invite)}
								class="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.04]"
							>
								<InviteLinkSummary {invite} />
								<span
									aria-label="Вступили: {invite.joined}"
									class="flex shrink-0 items-center gap-1 text-[12px] text-muted tabular-nums"
								>
									<Icon name="users" size={13} />
									{invite.joined}
									<Icon name="chevron" size={14} class="-rotate-90" />
								</span>
							</button>
							<button
								type="button"
								onclick={() => onrevoke(invite)}
								class="pressable h-8 shrink-0 rounded-full bg-white/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12]"
							>
								Удалить
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
		Удалённая ссылка сразу перестаёт работать. Нажмите на ссылку, чтобы увидеть, кто по ней
		вступил
	</p>
</section>
