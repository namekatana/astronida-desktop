<script lang="ts">
	import { fade } from 'svelte/transition';
	import { banUntilLabel } from '$lib/servers/moderation';
	import type { ServerBans } from '$lib/servers/server-bans.svelte';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import { reveal } from '$lib/ui/reveal';
	import Avatar from './Avatar.svelte';
	import CountedHeading from './CountedHeading.svelte';
	import Icon from './Icon.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		serverBans: ServerBans;
	}

	let { serverBans }: Props = $props();

	const bans = $derived(serverBans.bans);
	const unbanning = $derived(serverBans.unbanning);
	const slowLoading = createDelayedFlag(() => bans === null && serverBans.error === null);
</script>

<section aria-labelledby="server-bans">
	<CountedHeading
		id="server-bans"
		label="Заблокировано"
		count={bans?.length ?? null}
		error={serverBans.error}
	/>

	<div class="grid min-h-[132px] grid-cols-1 rounded-[14px] bg-tint/[0.05] [corner-shape:squircle]">
		{#if bans === null}
			{#if slowLoading.current}
				<div class="col-start-1 row-start-1 grid place-items-center" in:fade={{ duration: 150 }}>
					<Orbit size={24} label="Загрузка" class="text-muted" />
				</div>
			{/if}
		{:else if bans.length === 0}
			<div
				class="col-start-1 row-start-1 flex flex-col items-center justify-center px-6 py-6 text-center"
				in:fade={{ duration: 150 }}
			>
				<div class="grid size-10 place-items-center rounded-full bg-tint/[0.08] text-ink-secondary">
					<Icon name="member-ban" size={18} />
				</div>
				<p class="mt-3 text-[14px] leading-5 font-semibold text-ink">Никто не заблокирован</p>
			</div>
		{:else}
			<ul class="col-start-1 row-start-1 flex flex-col self-start" in:fade={{ duration: 150 }}>
				{#each bans as member, index (member.id)}
					<li transition:reveal>
						{#if index > 0}
							<div class="ml-[60px] h-px bg-tint/[0.06]"></div>
						{/if}
						<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
							<Avatar name={member.name} size={32} userId={member.id} avatarId={member.avatarId} />
							<div class="min-w-0 flex-1">
								<p class="truncate text-[14px] leading-5 text-ink">@{member.username}</p>
								<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
									{banUntilLabel(member.expiresAt)}
								</p>
							</div>
							<button
								type="button"
								disabled={unbanning !== null}
								onclick={() => serverBans.unban(member)}
								class="pressable grid h-8 shrink-0 place-items-center rounded-full bg-tint/[0.08] px-3.5 text-[12px] font-semibold text-ink duration-150 hover:bg-tint/[0.12] disabled:opacity-50"
							>
								<span
									class="col-start-1 row-start-1 transition-opacity duration-150 {unbanning ===
									member.id
										? 'opacity-0'
										: 'opacity-100'}"
								>
									Разблокировать
								</span>
								<Orbit
									size={16}
									class="col-start-1 row-start-1 transition-opacity duration-150 {unbanning ===
									member.id
										? 'opacity-100'
										: 'opacity-0'}"
								/>
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
		Заблокированные не могут вернуться по приглашению. Заблокировать участника — правой кнопкой по
		нему в списке, в чате или в голосовом канале
	</p>
</section>
