<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { draw, fade } from 'svelte/transition';
	import type { Workspace } from '$lib/cache/workspace-cache';
	import type { Friend } from '$lib/friends/friends';
	import { buildForwardSections, type ForwardTarget } from '$lib/messages/forward-targets';
	import { forwardMaxTargets, type ForwardResult } from '$lib/messages/message-actions';
	import { messageMaxLength, type Message } from '$lib/messages/messages';
	import type { Server } from '$lib/servers/servers';
	import Avatar from './Avatar.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import SearchField from './SearchField.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		message: Message;
		friends: (Friend & { online: boolean })[];
		servers: Server[];
		workspaces: Record<string, Workspace>;
		onforward: (input: {
			channelIds: string[];
			comment: string;
			clientId: string;
		}) => Promise<ForwardResult>;
		onclose: () => void;
	}

	let { message, friends, servers, workspaces, onforward, onclose }: Props = $props();

	type Phase = 'idle' | 'sending' | 'sent';

	const formId = 'forward-form';
	const closeAfterSentMs = 600;

	let query = $state('');
	let comment = $state('');
	let phase = $state<Phase>('idle');
	let error = $state<string | null>(null);
	let attempt: { signature: string; clientId: string } | null = null;
	let closeTimer: ReturnType<typeof setTimeout> | null = null;
	const selected = new SvelteSet<string>();

	const sections = $derived(buildForwardSections({ friends, servers, workspaces, query }));
	const hasAnyTarget = $derived(
		friends.some((friend) => friend.channelId) ||
			servers.some((server) =>
				workspaces[server.id]?.channels.some((channel) => channel.kind === 'text')
			)
	);
	const limitReached = $derived(selected.size >= forwardMaxTargets);
	const subtitle = $derived(
		error ??
			(selected.size === 0
				? null
				: limitReached
					? `Выбрано: ${selected.size} — это максимум`
					: `Выбрано: ${selected.size}`)
	);
	const quotedAuthor = $derived(message.forwardedFrom?.username ?? message.author.username);

	$effect(() => () => {
		if (closeTimer) clearTimeout(closeTimer);
	});

	function toggle(channelId: string) {
		if (phase !== 'idle') return;
		error = null;
		if (selected.has(channelId)) selected.delete(channelId);
		else if (!limitReached) selected.add(channelId);
	}

	function clientIdFor(signature: string): string {
		if (attempt?.signature !== signature) attempt = { signature, clientId: crypto.randomUUID() };
		return attempt.clientId;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (selected.size === 0 || phase !== 'idle') return;
		const channelIds = [...selected];
		const clientId = clientIdFor(JSON.stringify([channelIds, comment.trim()]));
		phase = 'sending';
		error = null;
		const result = await onforward({ channelIds, comment, clientId });
		if (result.ok) {
			phase = 'sent';
			closeTimer = setTimeout(onclose, closeAfterSentMs);
			return;
		}
		phase = 'idle';
		error =
			result.reason === 'rate_limited'
				? 'Слишком часто, попробуйте через минуту'
				: 'Не удалось переслать';
	}

	function singleLine(text: string): string {
		return text.replace(/\s+/g, ' ').trim();
	}

	function fillIn(_node: Element) {
		if (prefersReducedMotion.current) {
			return { duration: 120, css: (t: number) => `opacity: ${t}` };
		}
		return {
			duration: 180,
			easing: quintOut,
			css: (t: number) => `opacity: ${t}; transform: scale(${0.6 + 0.4 * t})`
		};
	}
</script>

<Dialog label="Переслать сообщение" wide flush pinTop {onclose}>
	<SheetHeader
		title="Переслать"
		{subtitle}
		subtitleDanger={error !== null}
		cancelLabel="Отмена"
		cancelDisabled={phase === 'sending'}
		oncancel={onclose}
		actionLabel="Отправить"
		actionForm={formId}
		actionDisabled={selected.size === 0}
		actionBusy={phase === 'sending'}
		actionDone={phase === 'sent'}
	/>

	<div class="px-4">
		<SearchField bind:value={query} />
	</div>

	<div
		class="scrollbar-none mt-1 h-[272px] overflow-y-auto px-2 py-2 [mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-10px),transparent)]"
	>
		{#if sections.length > 0}
			{#each sections as section (section.key)}
				<section>
					<h3 class="truncate px-3 pt-2 pb-1 text-[12px] font-semibold text-muted">
						{section.title}
					</h3>
					<ul class="flex flex-col gap-0.5">
						{#each section.targets as target (target.channelId)}
							<li>{@render targetRow(target)}</li>
						{/each}
					</ul>
				</section>
			{/each}
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
				{#if hasAnyTarget}
					<p class="text-[13px] text-ink">Ничего не нашлось</p>
					<p class="text-[12px] leading-5 text-muted">Проверьте ник друга или название канала</p>
				{:else}
					<p class="text-[13px] text-ink">Пока некуда пересылать</p>
					<p class="text-[12px] leading-5 text-muted">Добавьте друзей или вступите на сервер</p>
				{/if}
			</div>
		{/if}
	</div>

	<form id={formId} class="px-4 pt-1 pb-4" onsubmit={submit}>
		<div
			class="rounded-[14px] bg-white/[0.05] px-3.5 pt-2.5 pb-2 transition-colors duration-150 [corner-shape:squircle] focus-within:bg-white/[0.07]"
		>
			<p class="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-muted">
				<Icon name="forward" size={12} class="shrink-0" />
				<span class="shrink-0 font-semibold text-ink-secondary">@{quotedAuthor}</span>
				<span dir="auto" class="min-w-0 truncate [unicode-bidi:plaintext]">
					{singleLine(message.text)}
				</span>
			</p>
			<input
				bind:value={comment}
				type="text"
				maxlength={messageMaxLength}
				placeholder="Добавить комментарий…"
				aria-label="Комментарий"
				disabled={phase !== 'idle'}
				class="mt-1.5 h-6 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
			/>
		</div>
	</form>
</Dialog>

{#snippet targetRow(target: ForwardTarget)}
	{@const checked = selected.has(target.channelId)}
	{@const blocked = !checked && limitReached}
	<button
		type="button"
		role="checkbox"
		aria-checked={checked}
		disabled={blocked || phase !== 'idle'}
		onclick={() => toggle(target.channelId)}
		class="flex h-11 w-full items-center gap-3 rounded-[10px] px-2.5 text-left transition-[background-color,opacity] duration-150 [corner-shape:squircle] disabled:cursor-default {checked
			? 'bg-white/[0.06]'
			: 'enabled:hover:bg-white/[0.04]'} {blocked ? 'opacity-40' : ''}"
	>
		{#if target.kind === 'friend'}
			<Avatar name={target.name} size={32} class="relative">
				{#if target.online}
					<span
						class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface bg-online"
					></span>
				{/if}
			</Avatar>
			<span class="min-w-0 flex-1 truncate text-[14px] text-ink">@{target.username}</span>
		{:else}
			<span
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-muted"
			>
				<Icon name="text" size={15} />
			</span>
			<span class="min-w-0 flex-1 truncate text-[14px] text-ink">{target.name}</span>
		{/if}

		<span
			class="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150 {checked
				? 'border-transparent'
				: 'border-white/20'}"
		>
			{#if checked}
				<span class="absolute -inset-[1.5px] rounded-full bg-ink" in:fillIn out:fade={{ duration: 120 }}
				></span>
				<svg
					width="12"
					height="12"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="2.25"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					class="relative text-bg"
					out:fade={{ duration: 100 }}
				>
					<path
						d="M3.25 8.5 6.5 11.75 12.75 4.75"
						in:draw={{ duration: prefersReducedMotion.current ? 0 : 220, delay: 60 }}
					/>
				</svg>
			{/if}
		</span>
	</button>
{/snippet}
