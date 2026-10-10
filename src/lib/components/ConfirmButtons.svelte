<script lang="ts">
	import Orbit from './Orbit.svelte';

	interface Props {
		label: string;
		busy: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { label, busy, onconfirm, oncancel }: Props = $props();

	let cancelButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		cancelButton?.focus();
	});
</script>

<div class="grid grid-cols-2 gap-2">
	<button
		bind:this={cancelButton}
		type="button"
		disabled={busy}
		onclick={oncancel}
		class="h-11 rounded-[14px] bg-white/[0.05] text-[14px] font-medium text-ink transition-[background-color,opacity] duration-150 outline-none [corner-shape:squircle] hover:bg-white/[0.08] focus-visible:bg-white/[0.08] active:bg-white/[0.1] disabled:opacity-50 disabled:hover:bg-white/[0.05]"
	>
		Отмена
	</button>
	<button
		type="button"
		disabled={busy}
		aria-busy={busy}
		onclick={onconfirm}
		class="grid h-11 place-items-center rounded-[14px] bg-white/[0.05] text-[14px] font-semibold text-danger transition-colors duration-150 outline-none [corner-shape:squircle] hover:bg-danger/10 focus-visible:bg-danger/10 active:bg-danger/15 disabled:hover:bg-white/[0.05]"
	>
		<span
			class="col-start-1 row-start-1 transition-opacity duration-150 {busy
				? 'opacity-0'
				: 'opacity-100'}"
		>
			{label}
		</span>
		<Orbit
			size={16}
			class="col-start-1 row-start-1 transition-opacity duration-150 {busy
				? 'opacity-100'
				: 'opacity-0'}"
		/>
	</button>
</div>
