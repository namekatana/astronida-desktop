<script lang="ts">
	import { previewText, type Message } from './messages';
	import ConfirmButtons from '$lib/ui/ConfirmButtons.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import SheetHeader from '$lib/ui/SheetHeader.svelte';

	interface Props {
		message: Message;
		busy: boolean;
		error: string | null;
		onconfirm: () => void;
		onclose: () => void;
	}

	let { message, busy, error, onconfirm, onclose }: Props = $props();

	const photoCount = $derived(message.attachments?.length ?? 0);
	const photoLabel = $derived(photoCount > 1 ? `${photoCount} фото` : 'Фото');
</script>

<Dialog label="Удалить сообщение" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Удалить сообщение"
		subtitle={error ?? 'Пропадёт у всех участников чата'}
		subtitleDanger={error !== null}
	/>

	<div class="px-4 pb-4">
		<div class="rounded-plate bg-fill px-3.5 py-2.5 [corner-shape:squircle]">
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

		<div class="mt-3">
			<ConfirmButtons label="Удалить" {busy} {onconfirm} oncancel={onclose} />
		</div>
	</div>
</Dialog>
