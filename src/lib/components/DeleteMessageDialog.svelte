<script lang="ts">
	import { previewText, type Message } from '$lib/messages/messages';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		message: Message;
		busy: boolean;
		error: string | null;
		onconfirm: () => void;
		onclose: () => void;
	}

	let { message, busy, error, onconfirm, onclose }: Props = $props();

	let cancelButton = $state<HTMLButtonElement | null>(null);

	const photoCount = $derived(message.attachments?.length ?? 0);
	const photoLabel = $derived(photoCount > 1 ? `${photoCount} фото` : 'Фото');

	$effect(() => {
		cancelButton?.focus();
	});
</script>

<Dialog label="Удалить сообщение" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Удалить сообщение"
		subtitle={error ?? 'Пропадёт у всех участников чата'}
		subtitleDanger={error !== null}
	/>

	<div class="px-4 pb-4">
		<div class="rounded-[14px] bg-white/[0.05] px-3.5 py-2.5 [corner-shape:squircle]">
			<p class="flex min-w-0 items-center gap-1.5 text-[12px] leading-4">
				<span class="truncate font-semibold text-ink-secondary">@{message.author.username}</span>
				{#if photoCount > 0}
					<span class="flex shrink-0 items-center gap-1 text-muted">
						<Icon name="image" size={12} />
						{photoLabel}
					</span>
				{/if}
			</p>
			{#if message.text !== '' || photoCount === 0}
				<p
					dir="auto"
					class="mt-1 line-clamp-3 text-[13px] leading-[18px] break-words text-ink [unicode-bidi:plaintext]"
				>
					{previewText(message.text)}
				</p>
			{/if}
		</div>

		<div class="mt-3 grid grid-cols-2 gap-2">
			<button
				bind:this={cancelButton}
				type="button"
				disabled={busy}
				onclick={onclose}
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
