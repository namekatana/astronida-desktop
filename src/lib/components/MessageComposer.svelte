<script lang="ts">
	import { messageMaxLength } from '$lib/messages/messages';
	import Icon from './Icon.svelte';

	interface Props {
		channelName: string;
		onsend?: (text: string) => void;
	}

	let { channelName, onsend }: Props = $props();

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

	const canSend = $derived(value.trim().length > 0);

	function send() {
		if (!canSend) return;
		onsend?.(value.trim());
		value = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		send();
	}
</script>

<div class="panel relative flex shrink-0 items-end gap-1 overflow-hidden p-2">
	<div class="relative min-w-0 flex-1">
		<div
			bind:this={mirror}
			aria-hidden="true"
			class="invisible absolute inset-x-0 top-0 px-4 py-2.5 text-[14px] leading-5 break-words whitespace-pre-wrap"
		>
			{value}&#8203;
		</div>

		<textarea
			bind:value
			rows="1"
			maxlength={messageMaxLength}
			placeholder="Написать в {channelName}"
			aria-label="Сообщение"
			onkeydown={handleKeydown}
			style="height: {height}px"
			class="scrollbar-none block w-full resize-none rounded-xl bg-transparent px-4 py-2.5 text-[14px] leading-5 text-ink transition-[height] duration-[180ms] ease-soft outline-none placeholder:text-muted"
		></textarea>
	</div>

	<div class="flex shrink-0 items-center gap-1 pb-1">
		<button
			type="button"
			aria-label="Прикрепить файл"
			class="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink"
		>
			<Icon name="paperclip" size={18} />
		</button>

		<button
			type="button"
			aria-label="Отправить"
			disabled={!canSend}
			onclick={send}
			class="flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 ease-soft {canSend
				? 'bg-brand text-white hover:bg-brand/85'
				: 'bg-white/[0.06] text-muted'}"
		>
			<Icon name="arrow-up" />
		</button>
	</div>
</div>
