<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';
	import Icon from './Icon.svelte';

	interface Props {
		member: Member;
	}

	let { member }: Props = $props();

	const avatar = $derived(initials(member.name));
</script>

<div
	class="flex h-10 items-center gap-2.5 rounded-lg px-2.5 transition-colors duration-150 hover:bg-white/[0.04] {member.online
		? ''
		: 'opacity-50'}"
>
	<span class="relative shrink-0">
		<span
			class="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
		>
			{avatar}
		</span>
		{#if member.online}
			<span
				class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-online"
			></span>
		{/if}
	</span>

	<span class="min-w-0 truncate text-[13px] text-ink-secondary">@{member.username}</span>

	{#if member.owner}
		<span title="Создатель сервера" class="flex text-muted">
			<Icon name="crown" size={14} />
		</span>
	{/if}
</div>
