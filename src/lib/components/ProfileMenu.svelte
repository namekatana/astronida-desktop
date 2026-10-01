<script lang="ts">
	import { fade } from 'svelte/transition';
	import { dismissOn } from '$lib/ui/dismiss';
	import { pop } from '$lib/ui/pop';
	import Avatar from './Avatar.svelte';
	import MenuItem from './MenuItem.svelte';

	interface Props {
		username: string | null;
		signingOut?: boolean;
		onsignout: () => void;
	}

	let { username, signingOut = false, onsignout }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	const avatarInitial = $derived(username?.[0]?.toUpperCase() ?? '?');

	$effect(() => {
		if (!open || !root) return;
		return dismissOn(root, () => (open = false));
	});
</script>

<div bind:this={root} class="relative">
	<button
		type="button"
		aria-label="Профиль"
		aria-haspopup="menu"
		aria-expanded={open}
		title={username ? `@${username}` : undefined}
		onclick={() => (open = !open)}
		class="pressable flex h-10 w-10 items-center justify-center rounded-full duration-200 {open
			? 'bg-white/[0.06]'
			: 'hover:bg-white/[0.06]'}"
	>
		<span
			class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-[12px] font-medium text-ink"
		>
			{avatarInitial}
		</span>
	</button>

	{#if open}
		<div
			role="menu"
			aria-label="Аккаунт"
			in:pop={{ y: -4, duration: 180 }}
			out:fade={{ duration: 100 }}
			class="panel panel-floating absolute top-full right-0 z-50 mt-2 w-[224px] origin-top-right p-1.5"
		>
			<div class="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
				<Avatar name={username ?? '?'} size={32} />
				<div class="min-w-0">
					<div class="truncate text-[13px] font-medium text-ink">
						{username ? `@${username}` : '—'}
					</div>
					<div class="truncate text-[11px] text-muted">Аккаунт</div>
				</div>
			</div>
			<div class="mx-1.5 h-px bg-surface-line"></div>
			<div class="mt-1.5">
				<MenuItem
					icon="log-out"
					label="Выйти"
					destructive
					disabled={signingOut}
					onclick={() => {
						open = false;
						onsignout();
					}}
				/>
			</div>
		</div>
	{/if}
</div>
