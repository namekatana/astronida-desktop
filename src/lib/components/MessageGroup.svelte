<script lang="ts" module>
	const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
</script>

<script lang="ts">
	import { splitLinks } from '$lib/messages/links';
	import type { Message } from '$lib/messages/messages';
	import { inviteCodeInMessage } from '$lib/servers/invites';
	import type { Server } from '$lib/servers/servers';
	import { openExternal } from '$lib/ui/external-link';
	import { initials } from '$lib/ui/initials';
	import InviteCard from './InviteCard.svelte';
	import MessageMenu from './MessageMenu.svelte';

	interface Props {
		messages: Message[];
		oncancel?: (messageId: string) => void;
		onjoinedinvite?: (server: Server) => void;
		onopeninvite?: (code: string) => void;
	}

	let { messages, oncancel, onjoinedinvite, onopeninvite }: Props = $props();

	let menu = $state<{ messageId: string; x: number; y: number } | null>(null);

	function messageAt(target: EventTarget | null): Message | undefined {
		const row = target instanceof Element ? target.closest<HTMLElement>('[data-message-id]') : null;
		const messageId = row?.dataset.messageId;
		return messageId ? messages.find((message) => message.id === messageId) : messages[0];
	}

	function openMenu(event: MouseEvent) {
		const message = messageAt(event.target);
		if (!message || message.status === undefined || !oncancel) return;
		event.preventDefault();
		menu = { messageId: message.id, x: event.clientX, y: event.clientY };
	}

	$effect(() => {
		if (menu && !messages.some((message) => message.id === menu?.messageId)) menu = null;
	});

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

	const author = $derived(messages[0].author);
	const avatar = $derived(initials(author.name));
	const time = $derived(timeFormat.format(messages[0].sentAt));
</script>

<div
	role="group"
	oncontextmenu={openMenu}
	class="rounded-lg px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.03]"
>
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
				{@const inviteCode = message.status === undefined ? inviteCodeInMessage(message.text) : null}
				<div data-message-id={message.id}>
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
				</div>
			{/each}
		</div>
	</div>
</div>

{#if menu && oncancel}
	{@const messageId = menu.messageId}
	<MessageMenu
		x={menu.x}
		y={menu.y}
		onclose={() => (menu = null)}
		oncancel={() => oncancel(messageId)}
	/>
{/if}
