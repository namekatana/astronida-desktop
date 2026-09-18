<script lang="ts" module>
	const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
</script>

<script lang="ts">
	import type { Message } from '$lib/messages/messages';
	import { initials } from '$lib/ui/initials';

	interface Props {
		messages: Message[];
		onretry?: (messageId: string) => void;
	}

	let { messages, onretry }: Props = $props();

	const author = $derived(messages[0].author);
	const avatar = $derived(initials(author.name));
	const time = $derived(timeFormat.format(messages[0].sentAt));
</script>

<div class="rounded-lg px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.03]">
	<div class="flex gap-3">
		<span
			class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[12px] font-medium text-ink"
		>
			{avatar}
		</span>

		<div class="min-w-0 flex-1">
			<div class="flex items-baseline gap-2">
				<span class="truncate text-[14px] leading-5 font-medium text-ink">
					@{author.username}
				</span>
				<span class="shrink-0 text-[11px] text-muted">{time}</span>
			</div>

			{#each messages as message (message.id)}
				<p
					class="py-0.5 text-[14px] leading-5 break-words whitespace-pre-wrap text-ink-secondary transition-opacity duration-200 {message.status ===
					'sending'
						? 'opacity-50'
						: ''}"
				>
					{message.text}
				</p>
				{#if message.status === 'failed'}
					<p class="pb-0.5 text-[11px] text-danger">
						Не отправлено ·
						<button
							type="button"
							onclick={() => onretry?.(message.id)}
							class="underline underline-offset-2 hover:text-ink"
						>
							Повторить
						</button>
					</p>
				{/if}
			{/each}
		</div>
	</div>
</div>
