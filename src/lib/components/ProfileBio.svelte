<script lang="ts">
	import { tick } from 'svelte';
	import { bioMaxLength, bioMaxLines } from '$lib/profile/bio';
	import { settle } from '$lib/ui/settle';

	interface Props {
		bio: string | null;
		draft?: string | null;
		locked?: boolean;
		oninput?: (value: string) => void;
	}

	let { bio, draft = null, locked = false, oninput }: Props = $props();

	const lineLimitNoticeMs = 1500;

	let lineLimitHit = $state(false);
	let lineLimitTimer: ReturnType<typeof setTimeout> | undefined;

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
</script>

<section class="min-w-0">
	<div class="flex items-center justify-between gap-3 px-1 pb-1.5">
		<h3 class="text-[12px] leading-4 font-semibold text-muted">О себе</h3>
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
		<label
			class="block rounded-[14px] bg-white/[0.05] px-3.5 py-3 transition-[background-color,opacity] duration-150 [corner-shape:squircle] focus-within:bg-white/[0.07] {locked
				? 'opacity-60'
				: ''}"
		>
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
				class="block w-full resize-none bg-transparent text-[13px] leading-5 text-ink outline-none [field-sizing:content] [overflow-wrap:anywhere] placeholder:text-muted"
			></textarea>
		</label>
	{:else}
		<p
			dir="auto"
			class="rounded-[14px] bg-white/[0.05] px-3.5 py-3 text-[13px] leading-5 whitespace-pre-wrap [corner-shape:squircle] [overflow-wrap:anywhere] {bio
				? 'text-ink-secondary'
				: 'text-muted'}"
		>{bio ?? 'Описание пусто'}</p>
	{/if}
</section>
