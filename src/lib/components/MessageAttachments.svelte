<script lang="ts">
	import { albumRows, albumWidth, singleSize } from '$lib/media/album-layout';
	import { spoilers, type ScreenPoint } from '$lib/media/spoilers.svelte';
	import { uploadProgress } from '$lib/media/upload-progress.svelte';
	import type { Message, MessageAttachment } from '$lib/messages/messages';
	import { clientIdOf } from '$lib/messages/outbox';
	import AttachmentTile from './AttachmentTile.svelte';

	interface Props {
		message: Message;
		attachments: MessageAttachment[];
		waiting: boolean;
		onopen?: (message: Message, index: number, element: HTMLElement) => void;
	}

	let { message, attachments, waiting, onopen }: Props = $props();

	const pendingClientId = $derived(message.status === 'sending' ? clientIdOf(message.id) : null);
	const progress = $derived(
		pendingClientId === null ? null : (uploadProgress.get(pendingClientId) ?? 0)
	);
	const openable = $derived(message.status === undefined && onopen !== undefined);
	const spoilerKey = $derived(message.id);

	function reveal(origin: ScreenPoint | null) {
		spoilers.reveal(spoilerKey, origin);
	}

	function labelOf(index: number): string {
		return attachments.length === 1
			? 'Открыть фото'
			: `Открыть фото ${index + 1} из ${attachments.length}`;
	}

	function opener(index: number) {
		if (!openable) return undefined;
		return (element: HTMLElement) => onopen?.(message, index, element);
	}
</script>

{#if attachments.length === 1}
	{@const size = singleSize(attachments[0])}
	<div
		class="my-1 max-w-full overflow-hidden [clip-path:inset(0_round_12px)]"
		style="width: {size.width}px; aspect-ratio: {size.width} / {size.height}"
	>
		<AttachmentTile
			attachment={attachments[0]}
			label={labelOf(0)}
			{spoilerKey}
			{progress}
			{waiting}
			onopen={opener(0)}
			onreveal={reveal}
		/>
	</div>
{:else}
	<div
		class="my-1 flex max-w-full flex-col gap-0.5 overflow-hidden [clip-path:inset(0_round_12px)]"
		style="width: {albumWidth}px"
	>
		{#each albumRows(attachments) as row, rowIndex (rowIndex)}
			<div class="flex gap-0.5" style="height: {row.height}px">
				{#each row.tiles as tile (tile.index)}
					<div class="min-w-0" style="flex: {tile.share} 1 0%">
						<AttachmentTile
							attachment={tile.attachment}
							label={labelOf(tile.index)}
							{spoilerKey}
							{progress}
							{waiting}
							onopen={opener(tile.index)}
							onreveal={reveal}
						/>
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}
