<script lang="ts">
	import type { FriendActivity } from '$lib/friends/friends';
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';

	interface Props {
		member: Member;
		activity?: FriendActivity;
		active?: boolean;
		badged?: boolean;
	}

	let { member, activity, active = false, badged = false }: Props = $props();

	const avatar = $derived(initials(member.name));
</script>

<div
	class="flex h-12 items-center gap-2.5 rounded-lg px-2.5 transition-[background-color,opacity] duration-200 hover:bg-white/[0.04] {member.online
		? ''
		: 'opacity-50'}"
>
	<span class="relative shrink-0">
		<span
			class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
		>
			{avatar}
		</span>
		<span
			class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-online transition-[opacity,scale] duration-200 ease-soft {member.online
				? 'scale-100 opacity-100'
				: 'scale-50 opacity-0'}"
		></span>
	</span>

	<span class="min-w-0 flex-1 {badged ? 'pr-8' : ''}">
		<span
			class="block truncate text-[13px] transition-colors duration-150 {active
				? 'text-ink'
				: 'text-ink-secondary'}">@{member.username}</span
		>
		{#if activity?.kind === 'typing'}
			<span class="flex items-center gap-1.5 text-[11px] leading-4 text-muted">
				<span class="truncate">печатает</span>
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
