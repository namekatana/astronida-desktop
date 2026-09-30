<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		member: Member;
		active?: boolean;
	}

	let { member, active = false }: Props = $props();
</script>

<div
	class="flex h-10 items-center gap-2.5 rounded-lg px-2.5 transition-[background-color,opacity] duration-200 hover:bg-white/[0.04] {member.online
		? ''
		: 'opacity-50'}"
>
	<Avatar name={member.name} size={28} online={member.online} />

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
</div>
