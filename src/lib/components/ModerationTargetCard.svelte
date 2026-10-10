<script lang="ts">
	import type { ModerationTarget } from '$lib/servers/moderation-target';
	import Avatar from './Avatar.svelte';

	interface Props {
		target: ModerationTarget;
		serverName: string;
	}

	let { target, serverName }: Props = $props();
</script>

<div
	class="flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-3.5 py-2.5 [corner-shape:squircle]"
>
	<Avatar name={target.name} size={32} userId={target.id} avatarId={target.avatarId} />
	<div class="min-w-0">
		<p class="truncate text-[14px] leading-5 font-semibold text-ink">@{target.username}</p>
		<p class="truncate text-[12px] leading-4 text-muted">«{serverName}»</p>
	</div>
</div>
