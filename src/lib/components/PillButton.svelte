<script lang="ts">
	import type { Snippet } from 'svelte';
	import Orbit from './Orbit.svelte';

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
	class="grid h-14 w-full place-items-center rounded-full bg-ink text-[15px] font-medium text-bg outline-2 outline-offset-2 outline-transparent transition-[background-color,transform,outline-color] duration-[260ms] ease-out hover:bg-ink-hover hover:outline-white/40 focus-visible:outline-line-strong active:scale-[0.98] active:bg-ink-pressed active:duration-100 disabled:pointer-events-none"
>
	<span
		class="col-start-1 row-start-1 transition-opacity duration-150 {loading
			? 'opacity-0'
			: 'opacity-100'}"
	>
		{@render children()}
	</span>
	<Orbit
		size={20}
		class="col-start-1 row-start-1 transition-opacity duration-150 {loading
			? 'opacity-100'
			: 'opacity-0'}"
	/>
</button>
