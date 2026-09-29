<script lang="ts" module>
	const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
</script>

<script lang="ts">
	import { splitLinks } from '$lib/messages/links';
	import type { Message, MessageReply } from '$lib/messages/messages';
	import { inviteCodeInMessage } from '$lib/servers/invites';
	import type { Server } from '$lib/servers/servers';
	import { openExternal } from '$lib/ui/external-link';
	import { initials } from '$lib/ui/initials';
	import InviteCard from './InviteCard.svelte';

	interface Props {
		messages: Message[];
		selfId: string;
		highlightedId?: string | null;
		flashId?: string | null;
		canJumpTo?: (messageId: string) => boolean;
		onjump?: (messageId: string) => void;
		onflashend?: () => void;
		onjoinedinvite?: (server: Server) => void;
		onopeninvite?: (code: string) => void;
	}

	let {
		messages,
		selfId,
		highlightedId = null,
		flashId = null,
		canJumpTo,
		onjump,
		onflashend,
		onjoinedinvite,
		onopeninvite
	}: Props = $props();

	const linkClass =
		'text-ink underline decoration-white/30 underline-offset-2 transition-[text-decoration-color] duration-150 hover:decoration-white/80';

	function openLink(event: MouseEvent, href: string) {
		event.preventDefault();
		if (event.type === 'auxclick' && event.button !== 1) return;
		openExternal(href);
	}

	function openInvite(event: MouseEvent, code: string) {
		event.preventDefault();
		onopeninvite?.(code);
	}

	function singleLine(text: string): string {
		return text.replace(/\s+/g, ' ').trim();
	}

	function repliesToSelf(message: Message): boolean {
		return (
			message.status === undefined &&
			message.author.id !== selfId &&
			message.replyTo?.original?.author.id === selfId
		);
	}

	function rowBackground(message: Message): string {
		const menuOpen = highlightedId === message.id;
		if (repliesToSelf(message)) {
			return menuOpen
				? 'reply-mention rounded-l-none bg-white/[0.06]'
				: 'reply-mention rounded-l-none bg-white/[0.04] hover:bg-white/[0.06]';
		}
		return menuOpen ? 'bg-white/[0.03]' : 'hover:bg-white/[0.03]';
	}

	const author = $derived(messages[0].author);
	const avatar = $derived(initials(author.name));
	const time = $derived(timeFormat.format(messages[0].sentAt));
</script>

{#snippet quote(reply: MessageReply)}
	{@const jumpable = reply.original !== null && (canJumpTo?.(reply.id) ?? false)}
	<button
		type="button"
		disabled={!jumpable}
		onclick={() => onjump?.(reply.id)}
		aria-label={reply.original
			? `Перейти к сообщению @${reply.original.author.username}`
			: 'Ответ на удалённое сообщение'}
		class="pressable relative flex max-w-[420px] min-w-[min(200px,100%)] flex-col overflow-hidden rounded-[8px] bg-white/[0.05] py-1.5 pr-3 pl-[15px] text-left duration-150 disabled:cursor-default {jumpable
			? 'hover:bg-white/[0.08]'
			: ''}"
	>
		<span class="absolute inset-y-0 left-0 w-[3px] bg-white/40"></span>
		{#if reply.original}
			<span class="truncate text-[12px] leading-4 font-semibold text-ink-secondary">
				@{reply.original.author.username}
			</span>
			<span
				dir="auto"
				class="truncate text-[13px] leading-[18px] text-muted [unicode-bidi:plaintext]"
			>
				{singleLine(reply.original.text)}
			</span>
		{:else}
			<span class="truncate text-[13px] leading-[18px] text-muted italic">Сообщение удалено</span>
		{/if}
	</button>
{/snippet}

{#snippet messageBody(message: Message)}
	{@const inviteCode = message.status === undefined ? inviteCodeInMessage(message.text) : null}
	{#if message.replyTo}
		<div
			class="mt-1 mb-1 flex transition-opacity duration-200 {message.status === 'sending'
				? 'opacity-50'
				: ''}"
		>
			{@render quote(message.replyTo)}
		</div>
	{/if}
	<p
		dir="auto"
		class="py-0.5 text-[14px] leading-5 break-words whitespace-pre-wrap text-ink-secondary transition-opacity duration-200 select-text [unicode-bidi:plaintext] {message.status ===
		'sending'
			? 'opacity-50'
			: ''}"
	>
		{#each splitLinks(message.text) as segment, index (index)}{#if segment.kind === 'link'}<a href={segment.href} onclick={(event) => openLink(event, segment.href)} onauxclick={(event) => openLink(event, segment.href)} class={linkClass}>{segment.text}</a>{:else if segment.kind === 'invite' && onopeninvite}<a href={segment.text} onclick={(event) => openInvite(event, segment.code)} onauxclick={(event) => event.preventDefault()} class={linkClass}>{segment.text}</a>{:else}{segment.text}{/if}{/each}
	</p>
	{#if message.status === 'failed'}
		<p class="pb-0.5 text-[11px] text-danger">Не отправлено</p>
	{/if}
	{#if inviteCode && onjoinedinvite}
		<InviteCard code={inviteCode} onjoined={onjoinedinvite} />
	{/if}
{/snippet}

<div role="group" data-group-first={messages[0].id} class="py-1">
	{#each messages as message, index (message.id)}
		<div
			data-message-id={message.id}
			onanimationend={(event) => {
				if (event.target === event.currentTarget && flashId === message.id) onflashend?.();
			}}
			class="rounded-lg px-3 py-0.5 transition-colors duration-150 {index === 0
				? 'flex gap-3'
				: 'pl-14'} {rowBackground(message)} {flashId === message.id ? 'reply-flash' : ''}"
		>
			{#if index === 0}
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
					{@render messageBody(message)}
				</div>
			{:else}
				{@render messageBody(message)}
			{/if}
		</div>
	{/each}
</div>
