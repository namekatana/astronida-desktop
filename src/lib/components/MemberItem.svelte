<script lang="ts">
	import { avatarIn } from '$lib/profile/profile';
	import type { Member } from '$lib/servers/members';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		member: Member;
		active?: boolean;
		onopenprofile?: (source: HTMLElement | null) => void;
	}

	let { member, active = false, onopenprofile }: Props = $props();
</script>

<button
	type="button"
	onclick={(event) => onopenprofile?.(avatarIn(event.currentTarget))}
	class="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-[background-color,opacity] duration-200 hover:bg-white/[0.04] {member.online
		? ''
		: 'opacity-50'}"
>
	<Avatar name={member.name} size={28} online={member.online} status={member.status} />

	<span
		class="min-w-0 truncate text-[13px] transition-colors duration-150 {active
			? 'text-ink'
			: 'text-ink-secondary'}">@{member.username}</span
	>

	{#if member.owner}
		<span title="Создатель сервера" class="flex text-muted">
			<Icon name="crown" size={14} />
		</span>
	{/if}
</button>
