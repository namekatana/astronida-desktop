<script lang="ts">
	import type { ActiveFriend } from '$lib/friends/active-friends';
	import { avatarIn } from '$lib/profile/profile';
	import type { Member } from '$lib/servers/members';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		active: ActiveFriend[];
		onopenprofile?: (friend: Member, source: HTMLElement | null) => void;
	}

	let { active, onopenprofile }: Props = $props();
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
		<SmoothScroll scrollbar class="min-h-0 flex-1" contentClass="px-2.5 py-3">
			<div class="flex flex-col gap-0.5">
				{#each active as { friend, serverName, channelName } (friend.id)}
					<button
						type="button"
						onclick={(event) => onopenprofile?.(friend, avatarIn(event.currentTarget))}
						class="flex h-12 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors duration-200 hover:bg-white/[0.04]"
					>
						<Avatar name={friend.name} size={32} online status={friend.status} />
						<span class="flex min-w-0 flex-col">
							<span class="truncate text-[13px] text-ink-secondary">@{friend.username}</span>
							<span class="flex min-w-0 items-center gap-1 text-[11px] text-muted">
								<Icon name="voice" size={12} class="text-online" />
								<span class="truncate">{channelName} · {serverName}</span>
							</span>
						</span>
					</button>
				{/each}
			</div>
		</SmoothScroll>
	{/if}
</aside>
