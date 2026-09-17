<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { on } from 'svelte/events';

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
		if (!open) return;
		const offPointer = on(document, 'pointerdown', (event) => {
			if (root && !root.contains(event.target as Node)) open = false;
		});
		const offKey = on(document, 'keydown', (event) => {
			if (event.key === 'Escape') open = false;
		});
		return () => {
			offPointer();
			offKey();
		};
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
		class="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 {open
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
			in:fly={{ y: -6, duration: 220, easing: (t) => 1 - Math.pow(1 - t, 3) }}
			out:fade={{ duration: 120 }}
			class="panel absolute top-full right-0 z-50 mt-2 w-52 origin-top-right p-1.5"
		>
			<div class="px-3 pt-2 pb-2.5">
				<div class="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">Аккаунт</div>
				<div class="mt-0.5 truncate text-[13px] text-ink">
					{username ? `@${username}` : '—'}
				</div>
			</div>
			<div class="mx-1.5 h-px bg-surface-line"></div>
			<button
				type="button"
				role="menuitem"
				disabled={signingOut}
				onclick={() => {
					open = false;
					onsignout();
				}}
				class="mt-1.5 flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] text-ink-secondary transition-colors duration-150 hover:bg-white/[0.06] hover:text-danger disabled:opacity-60"
			>
				Выйти
			</button>
		</div>
	{/if}
</div>
