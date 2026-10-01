<script lang="ts">
	import type { Snippet } from 'svelte';
	import { avatarIn } from '$lib/profile/profile';
	import type { Member } from '$lib/servers/members';
	import Avatar from './Avatar.svelte';

	interface Props {
		friend: Member;
		trailing?: Snippet;
		onopenprofile?: (source: HTMLElement | null) => void;
	}

	let { friend, trailing, onopenprofile }: Props = $props();
</script>

<header class="panel flex shrink-0 items-center gap-2.5 px-5 py-3.5 text-ink">
	<button
		type="button"
		aria-label="Профиль @{friend.username}"
		onclick={(event) => onopenprofile?.(avatarIn(event.currentTarget))}
		class="-my-1 flex rounded-full transition-[filter] duration-150 hover:brightness-125"
	>
		<Avatar name={friend.name} size={24} online={friend.online} status={friend.status} />
	</button>
	<h1 class="min-w-0 truncate text-[15px] leading-6 font-semibold">@{friend.username}</h1>
	{@render trailing?.()}
</header>
