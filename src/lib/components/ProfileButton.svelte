<script lang="ts">
	import { fade } from 'svelte/transition';
	import { ownStatus } from '$lib/presence/own-status.svelte';
	import { statusDotClass } from '$lib/presence/status';
	import { createAvatarSource } from '$lib/profile/avatar-source.svelte';
	import { initials } from '$lib/ui/initials';

	interface Props {
		userId: string;
		avatarId: string | null;
		username: string | null;
		onprofile: (source: HTMLElement | null) => void;
	}

	let { userId, avatarId, username, onprofile }: Props = $props();

	let avatarElement = $state<HTMLSpanElement | null>(null);

	const picture = createAvatarSource(() => ({ userId, avatarId, variant: 'small' }));
	const showInitials = $derived(avatarId === null || picture.failed);
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
			class="relative flex h-full w-full items-center justify-center rounded-full bg-surface-raised text-[12px] font-medium text-ink"
		>
			{#if showInitials}{initials(username ?? '?')}{/if}
			{#if picture.url}
				<img
					src={picture.url}
					alt=""
					draggable="false"
					transition:fade={{ duration: 150 }}
					class="absolute inset-0 h-full w-full rounded-full object-cover"
				/>
			{/if}
		</span>
		<span
			data-avatar-dot
			class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface transition-[background-color] duration-200 ease-soft {statusDotClass[
				ownStatus.current
			]}"
		></span>
	</span>
</button>
