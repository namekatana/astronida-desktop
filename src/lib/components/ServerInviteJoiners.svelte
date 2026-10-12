<script lang="ts">
	import { fade } from 'svelte/transition';
	import {
		inviteJoinersLimit,
		joinedAtLabel,
		loadInviteJoiners,
		type InviteJoiner,
		type ServerInvite
	} from '$lib/servers/invites';
	import { createDelayedFlag } from '$lib/ui/delayed-flag.svelte';
	import Avatar from './Avatar.svelte';
	import CountedHeading from './CountedHeading.svelte';
	import Icon from './Icon.svelte';
	import InviteLinkSummary from './InviteLinkSummary.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		serverId: string;
		invite: ServerInvite;
	}

	let { serverId, invite }: Props = $props();

	let joiners = $state<InviteJoiner[] | null>(null);
	let error = $state<string | null>(null);

	const slowLoading = createDelayedFlag(() => joiners === null && error === null);

	$effect(() => {
		void loadInviteJoiners(serverId, invite.code).then((result) => {
			if (result.ok) joiners = result.joiners;
			else error = result.message;
		});
	});
</script>

<div
	class="flex min-h-[60px] items-center gap-3 rounded-[14px] bg-tint/[0.05] px-4 py-2.5 [corner-shape:squircle]"
>
	<InviteLinkSummary {invite} />
</div>

<section aria-labelledby="invite-joiners" class="mt-6">
	<CountedHeading id="invite-joiners" label="Вступили" count={joiners?.length ?? null} {error} />

	<div class="grid min-h-[132px] grid-cols-1 rounded-[14px] bg-tint/[0.05] [corner-shape:squircle]">
		{#if joiners === null}
			{#if slowLoading.current}
				<div class="col-start-1 row-start-1 grid place-items-center" in:fade={{ duration: 150 }}>
					<Orbit size={24} label="Загрузка" class="text-muted" />
				</div>
			{/if}
		{:else if joiners.length === 0}
			<div
				class="col-start-1 row-start-1 flex flex-col items-center justify-center px-6 py-6 text-center"
				in:fade={{ duration: 150 }}
			>
				<div class="grid size-10 place-items-center rounded-full bg-tint/[0.08] text-ink-secondary">
					<Icon name="users" size={18} />
				</div>
				<p class="mt-3 text-[14px] leading-5 font-semibold text-ink">Пока никто не вступил</p>
			</div>
		{:else}
			<ul class="col-start-1 row-start-1 flex flex-col self-start" in:fade={{ duration: 150 }}>
				{#each joiners as joiner, index (joiner.id)}
					<li>
						{#if index > 0}
							<div class="ml-[60px] h-px bg-tint/[0.06]"></div>
						{/if}
						<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
							<Avatar name={joiner.name} size={32} userId={joiner.id} avatarId={joiner.avatarId} />
							<div class="min-w-0 flex-1">
								<p class="truncate text-[14px] leading-5 text-ink">@{joiner.username}</p>
								<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
									{joinedAtLabel(joiner.joinedAt)}
								</p>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
		Здесь только те, кто сейчас на сервере: вышедшие и удалённые не показываются, а в счётчике
		использований остаются.{joiners !== null && joiners.length >= inviteJoinersLimit
			? ` Показаны последние ${inviteJoinersLimit}.`
			: ''}
	</p>
</section>
