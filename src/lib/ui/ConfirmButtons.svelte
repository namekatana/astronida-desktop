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
		class="pressable h-10 rounded-full bg-fill-raised text-[13px] font-semibold text-ink duration-150 outline-none hover:bg-fill-strong focus-visible:bg-fill-strong disabled:opacity-50 disabled:hover:bg-fill-raised"
	>
		Отмена
	</button>
	<button
		type="button"
		disabled={busy}
		aria-busy={busy}
		onclick={onconfirm}
		class="pressable grid h-10 place-items-center rounded-full bg-fill-raised text-[13px] font-semibold text-danger duration-150 outline-none hover:bg-danger/10 focus-visible:bg-danger/10 active:bg-danger/15 disabled:hover:bg-fill-raised"
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
