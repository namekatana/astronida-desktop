<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { statusDotClass, type UserStatus } from '$lib/presence/status';
	import { createAvatarSource } from '$lib/profile/avatar-source.svelte';
	import { avatarIdOf } from '$lib/profile/known-avatars.svelte';
	import { initials } from '$lib/ui/initials';

	type AvatarSize = 24 | 28 | 32 | 72;

	interface Props {
		name: string;
		size: AvatarSize;
		userId?: string;
		avatarId?: string | null;
		online?: boolean;
		status?: UserStatus;
		class?: string;
		children?: Snippet;
	}

	let {
		name,
		size,
		userId,
		avatarId,
		online,
		status = 'online',
		class: className = '',
		children
	}: Props = $props();

	const sizeClasses: Record<AvatarSize, string> = {
		24: 'h-6 w-6 text-[10px]',
		28: 'h-7 w-7 text-[11px]',
		32: 'h-8 w-8 text-[11px]',
		72: 'h-[72px] w-[72px] text-[22px]'
	};

	const expectedAvatarId = $derived(userId ? avatarIdOf(userId, avatarId) : null);
	const picture = createAvatarSource(() => ({
		userId: userId ?? '',
		avatarId: expectedAvatarId,
		variant: size === 72 ? 'large' : 'small'
	}));
	const showInitials = $derived(expectedAvatarId === null || picture.failed);

	const circleClass = $derived(
		`relative flex shrink-0 items-center justify-center rounded-full bg-surface-raised font-medium text-ink ${sizeClasses[size]}`
	);
</script>

{#snippet face()}
	{#if showInitials}{initials(name)}{/if}
	{#if picture.url}
		<img
			src={picture.url}
			alt=""
			draggable="false"
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 h-full w-full rounded-full object-cover"
		/>
	{/if}
{/snippet}

{#if online === undefined}
	<span data-avatar class="{circleClass} {className}">
		{@render face()}
		{@render children?.()}
	</span>
{:else}
	<span data-avatar class="relative shrink-0 {className}">
		<span class={circleClass}>{@render face()}</span>
		<span
			data-avatar-dot
			class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface transition-[opacity,scale,background-color] duration-200 ease-soft {statusDotClass[
				status
			]} {online ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}"
		></span>
	</span>
{/if}
