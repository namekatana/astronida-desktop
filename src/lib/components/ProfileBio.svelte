<script lang="ts">
	import { tick } from 'svelte';
	import { bioMaxLength, bioMaxLines } from '$lib/profile/bio';
	import { widgetTileClass } from '$lib/profile/widget-tile';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';

	interface Props {
		bio: string | null;
		draft?: string | null;
		locked?: boolean;
		oninput?: (value: string) => void;
		onmeasure?: (heightPx: number) => void;
	}

	let { bio, draft = null, locked = false, oninput, onmeasure }: Props = $props();

	const lineLimitNoticeMs = 1500;
	const verticalPaddingPx = 26;

	let lineLimitHit = $state(false);
	let lineLimitTimer: ReturnType<typeof setTimeout> | undefined;
	let content = $state<HTMLDivElement | null>(null);

	const editable = $derived(draft !== null && oninput !== undefined);
	const length = $derived(draft?.length ?? 0);
	const counter = $derived(lineLimitHit ? `Не больше ${bioMaxLines} строк` : `${length}/${bioMaxLength}`);

	async function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		const field = event.currentTarget;
		const { selectionStart, selectionEnd, selectionDirection } = field;
		oninput?.(field.value);
		await tick();
		if (document.activeElement !== field) return;
		if (field.selectionStart === selectionStart && field.selectionEnd === selectionEnd) return;
		field.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? 'none');
	}

	function showLineLimit() {
		lineLimitHit = true;
		clearTimeout(lineLimitTimer);
		lineLimitTimer = setTimeout(() => (lineLimitHit = false), lineLimitNoticeMs);
	}

	function blockExtraLine(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		const lineBreaks = event.currentTarget.value.split('\n').length - 1;
		if (lineBreaks < bioMaxLines - 1) return;
		event.preventDefault();
		showLineLimit();
	}

	$effect(() => {
		if (!editable) lineLimitHit = false;
	});

	$effect(() => {
		return () => clearTimeout(lineLimitTimer);
	});

	$effect(() => {
		const node = content;
		const report = onmeasure;
		if (!node || !report) return;
		const observer = new ResizeObserver(() => report(node.offsetHeight + verticalPaddingPx));
		observer.observe(node);
		return () => observer.disconnect();
	});
</script>

<svelte:element
	this={editable ? 'label' : 'section'}
	data-widget-card
	class="flex h-full min-w-0 flex-col overflow-hidden px-3.5 pt-3 pb-3.5 transition-[background-color,opacity] duration-150 {widgetTileClass} {editable
		? 'focus-within:bg-white/[0.07]'
		: ''} {locked ? 'opacity-60' : ''}"
>
	<div bind:this={content} class="flex min-w-0 flex-col">
		<div class="flex h-5 items-center justify-between gap-3">
			<h3 class="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-muted">
				<Icon name="note" size={13} />
				О себе
			</h3>
			{#if editable}
				<span class="grid grid-cols-1 justify-items-end" in:settle out:settle={{ duration: 100 }}>
					{#key lineLimitHit}
						<span
							aria-hidden="true"
							class="col-start-1 row-start-1 text-[12px] leading-4 whitespace-nowrap tabular-nums {lineLimitHit ||
							length >= bioMaxLength
								? 'text-ink-secondary'
								: 'text-muted'}"
							in:settle
							out:settle={{ duration: 100 }}
						>
							{counter}
						</span>
					{/key}
				</span>
			{/if}
		</div>

		{#if editable}
			<textarea
				value={draft}
				rows="1"
				dir="auto"
				maxlength={bioMaxLength}
				readonly={locked}
				placeholder="Расскажите о себе"
				aria-label="О себе, до {bioMaxLength} символов и {bioMaxLines} строк"
				oninput={handleInput}
				onkeydown={blockExtraLine}
				class="mt-1.5 block w-full resize-none bg-transparent text-[14px] leading-5 text-ink outline-none [field-sizing:content] [overflow-wrap:anywhere] placeholder:text-muted"
			></textarea>
		{:else if bio}
			<p
				dir="auto"
				class="mt-1.5 text-[14px] leading-5 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]"
			>{bio}</p>
		{/if}
	</div>

	{#if !editable && !bio}
		<p class="flex flex-1 items-center justify-center gap-1.5 text-[13px] text-muted">
			<Icon name="note" size={14} class="opacity-60" />
			Описание пусто
		</p>
	{/if}
</svelte:element>
