<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Member } from '$lib/servers/members';
	import Avatar from './Avatar.svelte';

	interface Props {
		friend: Member;
		trailing?: Snippet;
	}

	let { friend, trailing }: Props = $props();
</script>

<header class="panel flex shrink-0 items-center gap-2.5 px-5 py-3.5 text-ink">
	<Avatar name={friend.name} size={24} online={friend.online} class="-my-1" />
	<h1 class="min-w-0 truncate text-[15px] leading-6 font-semibold">@{friend.username}</h1>
	{@render trailing?.()}
</header>
