<script lang="ts">
	import { settle } from '$lib/ui/settle';
	import Dialog from './Dialog.svelte';

	interface Props {
		busy: boolean;
		error: string | null;
		onconfirm: () => void;
		onclose: () => void;
	}

	let { busy, error, onconfirm, onclose }: Props = $props();

	let confirmButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		confirmButton?.focus();
	});
</script>

<Dialog label="Удалить сообщение" alert flush locked={busy} {onclose}>
	<div class="px-5 pt-5 pb-4 text-center">
		<h2 class="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
			Удалить сообщение?
		</h2>
		<div class="mt-1 grid">
			{#key error}
				<p
					in:settle
					out:settle={{ duration: 100 }}
					class="col-start-1 row-start-1 text-[13px] leading-[18px] {error
						? 'text-danger'
						: 'text-ink-secondary'}"
				>
					{error ?? 'Оно исчезнет у всех участников чата'}
				</p>
			{/key}
		</div>
		<div class="mt-4 grid grid-cols-2 gap-2">
			<button
				type="button"
				disabled={busy}
				onclick={onclose}
				class="pressable h-9 rounded-full bg-white/[0.08] text-[14px] font-medium text-ink duration-150 outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-50"
			>
				Отмена
			</button>
			<button
				bind:this={confirmButton}
				type="button"
				disabled={busy}
				aria-busy={busy}
				onclick={onconfirm}
				class="pressable grid h-9 place-items-center rounded-full bg-white/[0.08] text-[14px] font-semibold text-danger duration-150 outline-none hover:bg-danger/15 focus-visible:ring-2 focus-visible:ring-white/20"
			>
				<span
					class="col-start-1 row-start-1 transition-[opacity,filter] duration-150 {busy
						? 'opacity-0 blur-[2px]'
						: 'opacity-100'}"
				>
					Удалить
				</span>
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
					class="col-start-1 row-start-1 animate-spin transition-opacity duration-150 {busy
						? 'opacity-100'
						: 'opacity-0'}"
				>
					<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" />
					<path
						d="M14 8a6 6 0 0 0-6-6"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>
	</div>
</Dialog>
