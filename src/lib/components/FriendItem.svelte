<script lang="ts">
	import type { FriendActivity } from '$lib/friends/friends';
	import type { Member } from '$lib/servers/members';
	import Avatar from './Avatar.svelte';

	interface Props {
		member: Member;
		activity?: FriendActivity;
		active?: boolean;
		badged?: boolean;
	}

	let { member, activity, active = false, badged = false }: Props = $props();
</script>

<div
	class="flex h-12 items-center gap-2.5 rounded-lg px-2.5 transition-[background-color,opacity] duration-200 hover:bg-white/[0.04] {member.online
		? ''
		: 'opacity-50'}"
>
	<Avatar
		name={member.name}
		size={32}
		userId={member.id}
		avatarId={member.avatarId}
		online={member.online}
		status={member.status}
	/>

	<span class="min-w-0 flex-1 {badged ? 'pr-8' : ''}">
		<span
			class="block truncate text-[13px] transition-colors duration-150 {active
				? 'text-ink'
				: 'text-ink-secondary'}">@{member.username}</span
		>
		{#if activity?.kind === 'typing'}
			<span class="flex items-center gap-1.5 text-[11px] leading-4 text-muted">
				<span class="truncate">Печатает</span>
				<span class="typing-dots flex shrink-0 items-center gap-0.5" aria-hidden="true">
					<span></span><span></span><span></span>
				</span>
			</span>
		{:else if activity}
			<span class="block truncate text-[11px] leading-4 text-muted"
				>{activity.own ? 'Вы: ' : ''}<bdi>{activity.text}</bdi></span
			>
		{/if}
	</span>
</div>
