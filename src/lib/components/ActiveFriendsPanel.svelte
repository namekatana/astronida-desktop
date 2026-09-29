<script lang="ts">
	import type { ActiveFriend } from '$lib/friends/active-friends';
	import { initials } from '$lib/ui/initials';
	import Icon from './Icon.svelte';

	interface Props {
		active: ActiveFriend[];
	}

	let { active }: Props = $props();
</script>

<aside class="panel flex min-h-0 flex-1 flex-col">
	<div class="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
		<h2 class="min-w-0 truncate text-[20px] leading-6 font-bold tracking-[-0.01em] text-ink">
			Активные контакты
		</h2>
		{#if active.length > 0}
			<span class="text-[12px] text-muted tabular-nums">{active.length}</span>
		{/if}
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	{#if active.length === 0}
		<div class="flex flex-1 items-center justify-center px-5 text-center">
			<span class="text-[13px] text-muted">Сейчас никого нет в голосе</span>
		</div>
	{:else}
		<div class="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
			<div class="flex flex-col gap-0.5">
				{#each active as { friend, serverName, channelName } (friend.id)}
					<div class="flex h-12 items-center gap-2.5 rounded-lg px-2.5">
						<span class="relative shrink-0">
							<span
								class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
							>
								{initials(friend.name)}
							</span>
							<span
								class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-online"
							></span>
						</span>
						<span class="flex min-w-0 flex-col">
							<span class="truncate text-[13px] text-ink-secondary">@{friend.username}</span>
							<span class="flex min-w-0 items-center gap-1 text-[11px] text-muted">
								<Icon name="voice" size={12} class="text-online" />
								<span class="truncate">{channelName} · {serverName}</span>
							</span>
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</aside>
