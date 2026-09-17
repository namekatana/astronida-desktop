<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		type?: 'button' | 'submit';
		loading?: boolean;
		onclick?: () => void;
	}

	let { children, type = 'button', loading = false, onclick }: Props = $props();
</script>

<button
	{type}
	{onclick}
	disabled={loading}
	aria-busy={loading}
	class="h-14 w-full rounded-full bg-ink text-[15px] font-medium text-bg outline-2 outline-offset-2 outline-transparent transition-[background-color,transform,outline-color] duration-[260ms] ease-out hover:bg-ink-hover hover:outline-white/40 focus-visible:outline-line-strong active:scale-[0.98] active:bg-ink-pressed active:duration-100 disabled:pointer-events-none disabled:opacity-60"
>
	{@render children()}
</button>
