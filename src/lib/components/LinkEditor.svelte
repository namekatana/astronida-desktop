<script lang="ts">
	import { untrack } from 'svelte';
	import { on } from 'svelte/events';
	import { fade } from 'svelte/transition';
	import {
		linkFromInput,
		linkLabelMaxLength,
		linkUrlMaxLength,
		type ProfileLink
	} from '$lib/profile/widgets';
	import { pop } from '$lib/ui/pop';
	import { settle } from '$lib/ui/settle';

	interface Props {
		link: ProfileLink | null;
		left: number;
		top: number;
		width: number;
		onsave: (link: ProfileLink) => string | null;
		ondelete: () => void;
		onclose: () => void;
	}

	let { link, left, top, width, onsave, ondelete, onclose }: Props = $props();

	let element = $state<HTMLDivElement | null>(null);
	let urlField = $state<HTMLInputElement | null>(null);
	let url = $state(untrack(() => link?.url ?? ''));
	let label = $state(untrack(() => link?.label ?? ''));
	let error = $state<string | null>(null);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const result = linkFromInput(url, label);
		if (!result.ok) {
			error = result.message;
			return;
		}
		error = onsave(result.link);
	}

	$effect(() => {
		urlField?.focus();
	});

	$effect(() => {
		const root = element;
		if (!root) return;
		const offPointer = on(document, 'pointerdown', (event) => {
			if (!root.contains(event.target as Node)) onclose();
		});
		const offKey = on(
			document,
			'keydown',
			(event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				event.stopPropagation();
				onclose();
			},
			{ capture: true }
		);
		return () => {
			offPointer();
			offKey();
		};
	});
</script>

<div
	bind:this={element}
	role="dialog"
	aria-label={link ? 'Изменить ссылку' : 'Новая ссылка'}
	in:pop={{ y: -4, duration: 180 }}
	out:fade={{ duration: 100 }}
	class="panel panel-floating absolute z-30 origin-top p-1.5"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{width}px"
>
	<form onsubmit={submit}>
		<div class="rounded-[12px] bg-white/[0.05] [corner-shape:squircle]">
			<label class="flex h-10 items-center gap-2 px-3">
				<span class="w-[68px] shrink-0 text-[12px] text-muted">Адрес</span>
				<input
					bind:this={urlField}
					bind:value={url}
					oninput={() => (error = null)}
					type="text"
					inputmode="url"
					spellcheck="false"
					autocomplete="off"
					maxlength={linkUrlMaxLength}
					placeholder="https://"
					class="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
				/>
			</label>
			<div class="ml-3 h-px bg-white/[0.06]"></div>
			<label class="flex h-10 items-center gap-2 px-3">
				<span class="w-[68px] shrink-0 text-[12px] text-muted">Подпись</span>
				<input
					bind:value={label}
					type="text"
					dir="auto"
					autocomplete="off"
					maxlength={linkLabelMaxLength}
					placeholder="Необязательно"
					class="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
				/>
			</label>
		</div>

		<div class="grid h-6 grid-cols-1 items-center px-1" aria-live="polite">
			{#key error}
				<p
					class="col-start-1 row-start-1 truncate text-[12px] text-danger"
					in:settle
					out:settle={{ duration: 100 }}
				>
					{error ?? ''}
				</p>
			{/key}
		</div>

		<div class="flex h-7 items-center justify-between px-2">
			{#if link}
				<button
					type="button"
					onclick={ondelete}
					class="text-[13px] text-danger transition-opacity duration-150 active:opacity-60"
				>
					Удалить
				</button>
			{:else}
				<button
					type="button"
					onclick={onclose}
					class="text-[13px] text-ink-secondary transition-[color,opacity] duration-150 hover:text-ink active:opacity-60"
				>
					Отмена
				</button>
			{/if}
			<button
				type="submit"
				class="text-[13px] font-semibold text-ink transition-opacity duration-150 active:opacity-60"
			>
				Готово
			</button>
		</div>
	</form>
</div>
