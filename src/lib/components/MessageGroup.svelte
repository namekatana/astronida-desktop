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
	import Icon from './Icon.svelte';
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

{#snippet replyConnector(reply: MessageReply, pending: boolean)}
	{@const jumpable = reply.original !== null && (canJumpTo?.(reply.id) ?? false)}
	<div
		class="group/reply relative flex h-6 min-w-0 items-center pl-11 transition-opacity duration-200 {pending
			? 'opacity-50'
			: ''}"
	>
		<span
			class="pointer-events-none absolute top-3 bottom-0 left-4 w-6 rounded-tl-[6px] border-t-[1.5px] border-l-[1.5px] transition-colors duration-150 {jumpable
				? 'border-white/20 group-hover/reply:border-white/40'
				: 'border-white/20'}"
		></span>
		<button
			type="button"
			disabled={!jumpable}
			onclick={() => onjump?.(reply.id)}
			aria-label={reply.original?.forwardedFrom
				? `Перейти к пересланному сообщению от @${reply.original.forwardedFrom.username}`
				: reply.original
					? `Перейти к сообщению @${reply.original.author.username}`
					: 'Ответ на удалённое сообщение'}
			class="flex h-6 max-w-full min-w-0 items-center gap-1.5 text-left text-[12px] leading-4 disabled:cursor-default"
		>
			{#if reply.original?.forwardedFrom}
				<span
					class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted"
				>
					<Icon name="forward" size={10} />
				</span>
				<span
					class="min-w-0 truncate text-muted transition-colors duration-150 {jumpable
						? 'group-hover/reply:text-ink-secondary'
						: ''}"
				>
					Пересланное сообщение от <span class="font-semibold text-ink-secondary"
						>@{reply.original.forwardedFrom.username}</span
					>
				</span>
			{:else if reply.original}
				<span
					class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[7px] font-semibold text-ink"
				>
					{initials(reply.original.author.name)}
				</span>
				<span
					class="shrink-0 font-semibold text-ink-secondary transition-colors duration-150 {jumpable
						? 'group-hover/reply:text-ink'
						: ''}"
				>
					@{reply.original.author.username}
				</span>
				<span
					dir="auto"
					class="min-w-0 truncate text-muted transition-colors duration-150 [unicode-bidi:plaintext] {jumpable
						? 'group-hover/reply:text-ink-secondary'
						: ''}"
				>
					{singleLine(reply.original.text)}
				</span>
			{:else}
				<span class="shrink-0 pr-0.5 whitespace-nowrap text-muted italic">Сообщение удалено</span>
			{/if}
		</button>
	</div>
{/snippet}

{#snippet messageText(message: Message)}
	<p
		dir="auto"
		class="py-0.5 text-[14px] leading-5 break-words whitespace-pre-wrap text-ink-secondary select-text [unicode-bidi:plaintext]"
	>
		{#each splitLinks(message.text) as segment, index (index)}{#if segment.kind === 'link'}<a href={segment.href} onclick={(event) => openLink(event, segment.href)} onauxclick={(event) => openLink(event, segment.href)} class={linkClass}>{segment.text}</a>{:else if segment.kind === 'invite' && onopeninvite}<a href={segment.text} onclick={(event) => openInvite(event, segment.code)} onauxclick={(event) => event.preventDefault()} class={linkClass}>{segment.text}</a>{:else}{segment.text}{/if}{/each}
	</p>
{/snippet}

{#snippet forwardedCard(message: Message, username: string, inviteCode: string | null)}
	<div
		class="mt-1 mb-1 flex max-w-[520px] min-w-[min(240px,100%)] flex-col rounded-[12px] border border-white/10 bg-white/[0.02] px-3 pt-2 pb-1.5"
	>
		<p class="flex h-4 items-center gap-1 text-[11px] font-medium text-muted">
			<Icon name="forward" size={12} class="shrink-0" />
			Переслано
		</p>
		<div class="mt-1.5 flex h-5 min-w-0 items-center gap-2">
			<span
				class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[8px] font-semibold text-ink"
			>
				{initials(username)}
			</span>
			<span class="truncate text-[13px] font-semibold text-ink">@{username}</span>
		</div>
		{@render messageText(message)}
		{#if inviteCode && onjoinedinvite}
			<InviteCard code={inviteCode} onjoined={onjoinedinvite} />
		{/if}
	</div>
{/snippet}

{#snippet messageBody(message: Message)}
	{@const inviteCode = message.status === undefined ? inviteCodeInMessage(message.text) : null}
	<div
		class="flex min-w-0 flex-col items-start transition-opacity duration-200 [&>*]:max-w-full {message.status ===
		'sending'
			? 'opacity-50'
			: ''}"
	>
		{#if message.forwardedFrom}
			{@render forwardedCard(message, message.forwardedFrom.username, inviteCode)}
		{:else}
			<div class="self-stretch">
				{@render messageText(message)}
				{#if inviteCode && onjoinedinvite}
					<InviteCard code={inviteCode} onjoined={onjoinedinvite} />
				{/if}
			</div>
		{/if}
	</div>
	{#if message.status === 'failed'}
		<p class="pb-0.5 text-[11px] text-danger">Не отправлено</p>
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
				? ''
				: 'pl-14'} {rowBackground(message)} {flashId === message.id ? 'reply-flash' : ''}"
		>
			{#if index === 0}
				{#if message.replyTo}
					{@render replyConnector(message.replyTo, message.status === 'sending')}
				{/if}
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
						{@render messageBody(message)}
					</div>
				</div>
			{:else}
				{@render messageBody(message)}
			{/if}
		</div>
	{/each}
</div>
