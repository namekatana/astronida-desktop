<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';

	interface Props {
		friend: Member;
	}

	let { friend }: Props = $props();
</script>

<header class="panel flex shrink-0 items-center gap-2.5 px-5 pt-4 pb-3 text-ink">
	<span class="relative -my-1 shrink-0">
		<span
			class="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-ink"
		>
			{initials(friend.name)}
		</span>
		<span
			class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-online transition-[opacity,scale] duration-200 ease-soft {friend.online
				? 'scale-100 opacity-100'
				: 'scale-50 opacity-0'}"
		></span>
	</span>
	<h1 class="min-w-0 truncate text-[15px] font-semibold">@{friend.username}</h1>
	<span class="ml-auto shrink-0 text-[12px] text-muted">
		{friend.online ? 'в сети' : 'не в сети'}
	</span>
</header>
