<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';
	import Icon from './Icon.svelte';

	interface Props {
		member: Member;
		active?: boolean;
	}

	let { member, active = false }: Props = $props();

	const avatar = $derived(initials(member.name));
</script>

<div
	class="flex h-10 items-center gap-2.5 rounded-lg px-2.5 transition-[background-color,opacity] duration-200 hover:bg-white/[0.04] {member.online
		? ''
		: 'opacity-50'}"
>
	<span class="relative shrink-0">
		<span
			class="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
		>
			{avatar}
		</span>
		<span
			class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-online transition-[opacity,scale] duration-200 ease-soft {member.online
				? 'scale-100 opacity-100'
				: 'scale-50 opacity-0'}"
		></span>
	</span>

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
