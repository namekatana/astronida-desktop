<script lang="ts">
	import { messageMaxLength, type MessageReply } from '$lib/messages/messages';
	import { hasVisibleContent } from '$lib/ui/visible-text';
	import Icon from './Icon.svelte';

	interface Props {
		placeholder: string;
		reply?: MessageReply | null;
		onsend?: (text: string) => void;
		ontyping?: () => void;
		oncancelreply?: () => void;
	}

	let { placeholder, reply = null, onsend, ontyping, oncancelreply }: Props = $props();

	let textarea = $state<HTMLTextAreaElement>();
	let lastReply: MessageReply | null = null;

	const shownReply = $derived.by(() => {
		if (reply) lastReply = reply;
		return reply ?? lastReply;
	});

	$effect(() => {
		if (reply) textarea?.focus();
	});

	const lineHeight = 20;
	const paddingY = 10;
	const maxLines = 6;
	const minHeight = lineHeight + paddingY * 2;
	const maxHeight = lineHeight * maxLines + paddingY * 2;

	let value = $state('');
	let height = $state(minHeight);
	let mirror = $state<HTMLDivElement>();

	$effect(() => {
		if (!mirror) return;
		const observer = new ResizeObserver(() => {
			if (!mirror) return;
			height = Math.min(maxHeight, Math.max(minHeight, mirror.offsetHeight));
		});
		observer.observe(mirror);
		return () => observer.disconnect();
	});

	const canSend = $derived(hasVisibleContent(value));
	const length = $derived(value.length);
	const counterColor = $derived(
		length >= messageMaxLength
			? 'text-danger'
			: length >= messageMaxLength - 200
				? 'text-warning'
				: 'text-muted'
	);

	function send() {
		if (!canSend) return;
		onsend?.(value.trim());
		value = '';
	}

	function handleInput() {
		if (value.trim().length > 0) ontyping?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		send();
	}
</script>

<div
	class="panel relative flex shrink-0 flex-col overflow-hidden rounded-[28px] p-2 [corner-shape:round]"
>
	<div class="collapsible {reply ? 'is-open' : ''}" inert={!reply}>
		<div>
			{#if shownReply}
				<div class="flex h-10 items-center gap-3 pl-4">
					<span class="h-8 w-0.5 shrink-0 rounded-full bg-ink"></span>
					<div class="min-w-0 flex-1 text-[12px] leading-4">
						{#if shownReply.original?.forwardedFrom}
							<p class="truncate text-muted">В ответ на пересланное сообщение</p>
							<p class="truncate text-ink-secondary">
								от <span class="font-semibold text-ink"
									>@{shownReply.original.forwardedFrom.username}</span
								>
							</p>
						{:else}
							<p class="truncate">
								<span class="text-muted">В ответ</span>
								<span class="font-semibold text-ink">
									{shownReply.original ? `@${shownReply.original.author.username}` : ''}
								</span>
							</p>
							<p dir="auto" class="truncate text-ink-secondary [unicode-bidi:plaintext]">
								{shownReply.original?.text.replace(/\s+/g, ' ') ?? ''}
							</p>
						{/if}
					</div>
					<button
						type="button"
						aria-label="Отменить ответ"
						onclick={oncancelreply}
						class="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.06] hover:text-ink"
					>
						<Icon name="close" size={16} />
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex items-end gap-1">
		<div class="relative min-w-0 flex-1">
			<div
				bind:this={mirror}
				aria-hidden="true"
				class="invisible absolute inset-x-0 top-0 px-4 py-2.5 text-[14px] leading-5 break-words whitespace-pre-wrap"
			>
				{value}&#8203;
			</div>

			<textarea
				bind:this={textarea}
				bind:value
				rows="1"
				maxlength={messageMaxLength}
				{placeholder}
				aria-label="Сообщение"
				onkeydown={handleKeydown}
				oninput={handleInput}
				style="height: {height}px"
				class="scrollbar-none block w-full resize-none rounded-xl bg-transparent px-4 py-2.5 text-[14px] leading-5 text-ink transition-[height] duration-[180ms] ease-soft outline-none placeholder:text-muted"
			></textarea>
		</div>

		<div class="flex shrink-0 items-center gap-1 pb-1">
			<span
				aria-live="polite"
				class="w-[72px] shrink-0 pr-1 text-right text-[11px] whitespace-nowrap transition-[color,opacity] duration-200 tabular-nums {counterColor} {length >
				0
					? 'opacity-100'
					: 'opacity-0'}"
			>
				{length}/{messageMaxLength}
			</span>
			<button
				type="button"
				aria-label="Прикрепить файл"
				class="pressable flex h-8 w-8 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.06] hover:text-ink"
			>
				<Icon name="paperclip" size={18} />
			</button>

			<button
				type="button"
				aria-label="Отправить"
				disabled={!canSend}
				onclick={send}
				class="pressable flex h-8 w-8 items-center justify-center rounded-full duration-200 ease-soft {canSend
					? 'bg-ink text-bg hover:bg-ink-hover active:bg-ink-pressed'
					: 'bg-white/[0.06] text-muted'}"
			>
				<Icon name="arrow-up" />
			</button>
		</div>
	</div>
</div>
