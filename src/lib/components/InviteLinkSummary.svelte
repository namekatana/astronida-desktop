<script lang="ts">
	import { describeServerInvite, inviteLinkOf, type ServerInvite } from '$lib/servers/invites';
	import Icon from './Icon.svelte';

	interface Props {
		invite: ServerInvite;
	}

	let { invite }: Props = $props();
</script>

<div class="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-ink-secondary">
	<Icon name="link" size={16} />
</div>
<div class="min-w-0 flex-1">
	<p class="truncate text-[14px] leading-5 text-ink">{inviteLinkOf(invite.code)}</p>
	<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
		{describeServerInvite(invite, new Date())}
	</p>
</div>
