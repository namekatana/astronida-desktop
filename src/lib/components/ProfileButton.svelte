<script lang="ts">
	import { ownStatus } from '$lib/presence/own-status.svelte';
	import { statusDotClass } from '$lib/presence/status';
	import { initials } from '$lib/ui/initials';

	interface Props {
		username: string | null;
		onprofile: (source: HTMLElement | null) => void;
	}

	let { username, onprofile }: Props = $props();

	let avatarElement = $state<HTMLSpanElement | null>(null);
</script>

<button
	type="button"
	aria-label="Мой профиль"
	title={username ? `@${username}` : undefined}
	onclick={() => onprofile(avatarElement)}
	class="pressable flex h-10 w-10 items-center justify-center rounded-full duration-200 hover:bg-white/[0.06]"
>
	<span bind:this={avatarElement} data-avatar class="relative h-8 w-8">
		<span
			class="flex h-full w-full items-center justify-center rounded-full bg-surface-raised text-[12px] font-medium text-ink"
		>
			{initials(username ?? '?')}
		</span>
		<span
			data-avatar-dot
			class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface transition-[background-color] duration-200 ease-soft {statusDotClass[
				ownStatus.current
			]}"
		></span>
	</span>
</button>
