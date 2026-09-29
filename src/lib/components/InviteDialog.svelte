<script lang="ts">
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { draw } from 'svelte/transition';
	import { normalizeUsernameQuery, type Friend } from '$lib/friends/friends';
	import { fetchInviteLink, type InviteLink } from '$lib/servers/invites';
	import { initials } from '$lib/ui/initials';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import InviteSettingsView from './InviteSettingsView.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		serverId: string;
		serverName: string;
		friends: Friend[];
		memberIds: ReadonlySet<string>;
		canManage: boolean;
		oninvite: (channelId: string, link: string) => void;
		onclose: () => void;
	}

	let { serverId, serverName, friends, memberIds, canManage, oninvite, onclose }: Props =
		$props();

	type LinkState =
		| { status: 'loading' }
		| { status: 'ready'; invite: InviteLink }
		| { status: 'failed' };

	type View = 'invite' | 'settings';

	const staggeredRows = 8;
	const viewShift = 24;
	const openedAt = performance.now();

	let view = $state<View>('invite');
	let inviteHeight = $state(0);
	let settingsHeight = $state(0);
	let query = $state('');
	let linkState = $state<LinkState>({ status: 'loading' });
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;
	const invited = new SvelteSet<string>();
	const flashing = new SvelteSet<string>();

	const invite = $derived(linkState.status === 'ready' ? linkState.invite : null);
	let shownHeight = $state(0);

	$effect(() => {
		const measured = view === 'invite' ? inviteHeight : settingsHeight;
		if (measured > 0) shownHeight = measured;
	});

	const shownFriends = $derived.by(() => {
		const sorted = [...friends].sort((a, b) => a.username.localeCompare(b.username));
		return query ? sorted.filter((friend) => friend.username.includes(query)) : sorted;
	});

	$effect(() => {
		const target = serverId;
		let active = true;
		linkState = { status: 'loading' };
		void fetchInviteLink(target).then((loaded) => {
			if (!active) return;
			linkState = loaded ? { status: 'ready', invite: loaded } : { status: 'failed' };
		});
		return () => {
			active = false;
			if (copiedTimer) clearTimeout(copiedTimer);
		};
	});

	function inviteFriend(friend: Friend) {
		if (!invite || !friend.channelId || invited.has(friend.id)) return;
		oninvite(friend.channelId, invite.link);
		invited.add(friend.id);
		if (!prefersReducedMotion.current) flashing.add(friend.id);
	}

	async function copyLink() {
		if (!invite) return;
		try {
			await navigator.clipboard.writeText(invite.link);
		} catch {
			return;
		}
		copied = true;
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), 1500);
	}

	function useGeneratedLink(generated: InviteLink) {
		linkState = { status: 'ready', invite: generated };
		copied = false;
		view = 'invite';
	}

	function viewIn(_node: Element, { from }: { from: number }) {
		if (prefersReducedMotion.current) {
			return { duration: 180, css: (t: number) => `opacity: ${t}` };
		}
		return {
			delay: 60,
			duration: 260,
			easing: cubicOut,
			css: (t: number, u: number) => `opacity: ${t}; transform: translateX(${u * from}px)`
		};
	}

	function viewOut(_node: Element, { to }: { to: number }) {
		if (prefersReducedMotion.current) {
			return { duration: 120, css: (t: number) => `opacity: ${t}` };
		}
		return {
			duration: 180,
			easing: cubicIn,
			css: (t: number, u: number) => `opacity: ${t}; transform: translateX(${u * to}px)`
		};
	}

	function rowIn(_node: Element, { index }: { index: number }) {
		if (index >= staggeredRows || performance.now() - openedAt > 150) return { duration: 0 };
		const delay = 80 + index * 30;
		if (prefersReducedMotion.current) {
			return { delay, duration: 200, css: (t: number) => `opacity: ${t}` };
		}
		return {
			delay,
			duration: 260,
			easing: cubicOut,
			css: (t: number, u: number) => `opacity: ${t}; transform: translateY(${u * 6}px)`
		};
	}

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<Dialog label={view === 'invite' ? 'Пригласить друзей' : 'Настройки ссылки'} wide {onclose}>
	<div
		class="-mx-2 grid overflow-hidden px-2 transition-[height] duration-[260ms] ease-move motion-reduce:transition-none"
		style:height={shownHeight > 0 ? `${shownHeight}px` : null}
	>
		{#if view === 'invite'}
			<div
				bind:offsetHeight={inviteHeight}
				class="col-start-1 row-start-1 self-start"
				in:viewIn={{ from: -viewShift }}
				out:viewOut={{ to: -viewShift }}
			>
				{@render inviteView()}
			</div>
		{:else}
			<div
				bind:offsetHeight={settingsHeight}
				class="col-start-1 row-start-1 self-start"
				in:viewIn={{ from: viewShift }}
				out:viewOut={{ to: viewShift }}
			>
				<InviteSettingsView
					{serverId}
					onback={() => (view = 'invite')}
					oncreated={useGeneratedLink}
				/>
			</div>
		{/if}
	</div>
</Dialog>

{#snippet inviteView()}
	<h2 class="text-center text-[15px] font-semibold text-ink">Пригласить друзей</h2>
	<p
		class="mx-auto mt-1 max-w-[300px] truncate text-center text-[13px] leading-5 text-ink-secondary"
	>
		на сервер «{serverName}»
	</p>

	<div class="mt-4">
		<PillInput
			label="Поиск друзей"
			prefix="@"
			bind:value={query}
			transform={normalizeUsernameQuery}
		>
			{#snippet trailing()}
				<span class="flex text-muted"><Icon name="search" size={16} /></span>
			{/snippet}
		</PillInput>
	</div>

	<div class="scrollbar-none -mx-2 mt-3 h-[216px] overflow-y-auto">
		{#if shownFriends.length > 0}
			<ul class="flex flex-col gap-0.5">
				{#each shownFriends as friend, index (friend.id)}
					<li
						in:rowIn|global={{ index }}
						onanimationend={(event) => {
							if (event.target === event.currentTarget) flashing.delete(friend.id);
						}}
						class="flex h-12 items-center gap-3 rounded-lg px-2.5 transition-colors duration-150 hover:bg-white/[0.05] {flashing.has(
							friend.id
						)
							? 'invite-flash'
							: ''}"
					>
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
						>
							{initials(friend.name)}
						</span>
						<span class="min-w-0 flex-1 truncate text-[13px] text-ink">@{friend.username}</span>
						<span class="grid shrink-0 justify-items-end">
							{#key memberIds.has(friend.id) || invited.has(friend.id)}
								<span class="col-start-1 row-start-1 flex" in:settle out:settle={{ duration: 100 }}>
									{@render action(friend)}
								</span>
							{/key}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
				{#if friends.length === 0}
					<p class="text-[13px] text-ink">Пока некого пригласить</p>
					<p class="text-[12px] leading-5 text-muted">Добавьте друзей или отправьте ссылку ниже</p>
				{:else}
					<p class="text-[13px] text-ink">Никого не нашлось</p>
					<p class="text-[12px] leading-5 text-muted">Проверьте имя пользователя</p>
				{/if}
			</div>
		{/if}
	</div>

	<div class="mt-4 flex items-center gap-3">
		<span class="h-px flex-1 bg-surface-line"></span>
		<p class="text-[13px] font-semibold text-ink">Или отправьте ссылку</p>
		<span class="h-px flex-1 bg-surface-line"></span>
	</div>
	<div class="mt-3 flex h-12 items-center gap-2 rounded-full border border-line pr-1.5 pl-5">
		<span
			class="min-w-0 flex-1 truncate text-[13px] select-text {invite
				? 'text-ink-secondary'
				: 'text-muted'}"
		>
			{#if invite}
				{invite.link}
			{:else if linkState.status === 'loading'}
				Создаём ссылку…
			{:else}
				Не удалось получить ссылку
			{/if}
		</span>
		<button
			type="button"
			disabled={!invite}
			onclick={copyLink}
			class="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] duration-150 disabled:opacity-50 {copied
				? 'bg-online/10 text-online'
				: 'bg-white/[0.06] text-ink-secondary hover:bg-white/[0.1] hover:text-ink'}"
		>
			<Icon name={copied ? 'check' : 'copy'} size={13} />
			{copied ? 'Скопировано' : 'Копировать'}
		</button>
	</div>
	<p class="mx-auto mt-2 max-w-[300px] text-center text-[12px] leading-5 text-muted">
		Все ссылки-приглашения перестают действовать через 7 дней.
		{#if canManage}
			<button
				type="button"
				onclick={() => (view = 'settings')}
				class="link-underline text-ink-secondary transition-colors duration-200 hover:text-ink"
			>
				Изменить ссылку
			</button>
		{/if}
	</p>

	<div class="flex justify-center pt-3">
		<button
			type="button"
			onclick={onclose}
			class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink"
		>
			Закрыть
		</button>
	</div>
{/snippet}

{#snippet action(friend: Friend)}
	{#if memberIds.has(friend.id)}
		<span class="flex h-8 items-center gap-1.5 px-1 text-[12px] text-muted">
			<Icon name="user-check" size={14} />
			На сервере
		</span>
	{:else if invited.has(friend.id)}
		<span class="flex h-8 items-center gap-1.5 px-1 text-[12px] text-muted">
			<svg
				width="14"
				height="14"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width={1.5 * (16 / 14)}
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				class="shrink-0"
			>
				<path
					d="M3.25 8.5 6.5 11.75 12.75 4.75"
					in:draw|global={{ duration: flashing.has(friend.id) ? 320 : 0, delay: 120 }}
				/>
			</svg>
			Отправлено
		</span>
	{:else}
		<button
			type="button"
			disabled={!invite || !friend.channelId}
			onclick={() => inviteFriend(friend)}
			class="pressable flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-ink duration-150 hover:border-line-strong disabled:opacity-50"
		>
			<Icon name="user-plus" size={14} />
			Пригласить
		</button>
	{/if}
{/snippet}

<style>
	.invite-flash {
		animation: invite-flash 900ms var(--ease-soft);
	}

	@keyframes invite-flash {
		0% {
			background-color: rgba(255, 255, 255, 0.12);
		}
		100% {
			background-color: transparent;
		}
	}
</style>
