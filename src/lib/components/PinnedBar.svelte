<script lang="ts">
	import { fade } from 'svelte/transition';
	import { previewText, type Message } from '$lib/messages/messages';
	import Icon from './Icon.svelte';

	interface Props {
		message: Message | null;
		position: number;
		count: number;
		collapsed: boolean;
		busy: boolean;
		error: string | null;
		onopen: () => void;
		onhide: () => void;
	}

	let { message, position, count, collapsed, busy, error, onopen, onhide }: Props = $props();

	let lastMessage = $state<Message | null>(null);

	$effect(() => {
		if (message) lastMessage = message;
	});

	const open = $derived(message !== null && !collapsed);
	const shown = $derived(message ?? lastMessage);
	const label = $derived(
		count > 1 ? `Закреплённое · ${position + 1} из ${count}` : 'Закреплённое сообщение'
	);
	const preview = $derived(shown ? previewText(shown.text).replace(/\s+/g, ' ') : '');
</script>

<div class="collapsible shrink-0 {open ? 'is-open' : ''}" inert={!open}>
	<div>
		<div class="px-2 pt-2">
			<div class="flex h-12 items-center gap-1 rounded-[10px] bg-white/[0.04] pr-2">
				<button
					type="button"
					onclick={onopen}
					disabled={busy}
					aria-label="Показать закреплённое сообщение"
					class="group flex h-full min-w-0 flex-1 items-center gap-3 pl-3 text-left transition-opacity duration-150 {busy
						? 'opacity-50'
						: ''}"
				>
					<Icon name="pin" size={16} class="shrink-0 text-muted" />
					<span class="flex min-w-0 flex-1 flex-col">
						<span
							class="truncate text-[12px] leading-4 font-semibold tabular-nums {error
								? 'text-danger'
								: 'text-muted'}"
						>
							{error ?? label}
						</span>
						{#if shown}
							{#key shown.id}
								<span
									in:fade={{ duration: 150 }}
									dir="auto"
									class="truncate text-[13px] leading-5 text-ink-secondary transition-colors duration-150 group-hover:text-ink"
								>
									<span class="font-semibold text-ink">@{shown.author.username}</span>
									{preview}
								</span>
							{/key}
						{/if}
					</span>
				</button>
				<button
					type="button"
					onclick={onhide}
					aria-label="Скрыть закреплённые"
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink"
				>
					<Icon name="chevron" size={16} class="rotate-180" />
				</button>
			</div>
		</div>
	</div>
</div>
