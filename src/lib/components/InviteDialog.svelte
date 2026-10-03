<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';
	import { normalizeUsernameQuery, type Friend } from '$lib/friends/friends';
	import { cachedInviteLink, fetchInviteLink, type InviteLink } from '$lib/servers/invites';
	import { membersAmong } from '$lib/servers/members';
	import { settle } from '$lib/ui/settle';
	import Avatar from './Avatar.svelte';
	import Dialog from './Dialog.svelte';
	import DrawnCheck from './DrawnCheck.svelte';
	import Icon from './Icon.svelte';
	import InviteSettingsPanel from './InviteSettingsPanel.svelte';
	import Orbit from './Orbit.svelte';
	import SearchField from './SearchField.svelte';
	import SheetHeader from './SheetHeader.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		serverId: string;
		serverName: string;
		friends: Friend[];
		canManage: boolean;
		oninvite: (channelId: string, link: string) => void;
		onclose: () => void;
	}

	let { serverId, serverName, friends, canManage, oninvite, onclose }: Props = $props();

	const memberIds = new SvelteSet<string>();
	const friendIdList = $derived(friends.map((friend) => friend.id).join(','));

	$effect(() => {
		const target = serverId;
		const ids = friendIdList ? friendIdList.split(',') : [];
		let current = true;
		void membersAmong(target, ids).then((members) => {
			if (!current) return;
			memberIds.clear();
			for (const id of members) memberIds.add(id);
		});
		return () => {
			current = false;
		};
	});

	type LinkState =
		| { status: 'loading' }
		| { status: 'ready'; invite: InviteLink }
		| { status: 'failed' };

	const slowLoadingMs = 400;

	function initialLinkState(target: string): LinkState {
		const cached = cachedInviteLink(target);
		return cached ? { status: 'ready', invite: cached } : { status: 'loading' };
	}

	let settingsOpen = $state(false);
	let query = $state('');
	// svelte-ignore state_referenced_locally
	let linkState = $state<LinkState>(initialLinkState(serverId));
	let slowLoading = $state(false);
	let generated = false;
	let copied = $state(false);
	let linkFlashing = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;
	const invited = new SvelteSet<string>();
	const flashing = new SvelteSet<string>();

	const invite = $derived(linkState.status === 'ready' ? linkState.invite : null);
	const linkUnavailable = $derived(
		linkState.status === 'failed' || (linkState.status === 'loading' && slowLoading)
	);

	const shownFriends = $derived.by(() => {
		const sorted = [...friends].sort((a, b) => a.username.localeCompare(b.username));
		return query ? sorted.filter((friend) => friend.username.includes(query)) : sorted;
	});

	$effect(() => {
		const target = serverId;
		let active = true;
		const cached = cachedInviteLink(target);
		linkState = cached ? { status: 'ready', invite: cached } : { status: 'loading' };
		slowLoading = false;
		const slowTimer = setTimeout(() => (slowLoading = true), slowLoadingMs);
		void fetchInviteLink(target).then((loaded) => {
			clearTimeout(slowTimer);
			if (!active || generated) return;
			if (loaded) linkState = { status: 'ready', invite: loaded };
			else if (!cached) linkState = { status: 'failed' };
		});
		return () => {
			active = false;
			clearTimeout(slowTimer);
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
		flashLink();
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), 1500);
	}

	function flashLink() {
		if (prefersReducedMotion.current) return;
		linkFlashing = false;
		requestAnimationFrame(() => (linkFlashing = true));
	}

	function useGeneratedLink(created: InviteLink) {
		generated = true;
		linkState = { status: 'ready', invite: created };
		copied = false;
		settingsOpen = false;
		setTimeout(flashLink, 120);
	}
</script>

<Dialog label="Пригласить друзей" wide flush pinTop {onclose}>
	<SheetHeader
		title="Пригласить"
		subtitle={`«${serverName}»`}
		actionLabel="Готово"
		onaction={onclose}
	/>

	<div class="px-4">
		<SearchField
			bind:value={query}
			placeholder="Поиск друзей"
			transform={normalizeUsernameQuery}
		/>
	</div>

	<SmoothScroll
		class="mt-1 h-[244px] [mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-10px),transparent)]"
		contentClass="flex min-h-full flex-col px-2 py-2"
	>
		{#if shownFriends.length > 0}
			<h3 class="px-3 pt-2 pb-1 text-[12px] font-semibold text-muted">Друзья</h3>
			<ul class="flex flex-col gap-0.5">
				{#each shownFriends as friend (friend.id)}
					<li
						onanimationend={(event) => {
							if (event.target === event.currentTarget) flashing.delete(friend.id);
						}}
						class="flex h-11 items-center gap-3 rounded-[10px] px-2.5 transition-colors duration-150 [corner-shape:squircle] hover:bg-white/[0.04] {flashing.has(
							friend.id
						)
							? 'invite-flash'
							: ''}"
					>
						<Avatar name={friend.name} size={32} />
						<span class="min-w-0 flex-1 truncate text-[14px] text-ink">@{friend.username}</span>
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
			<div class="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
				{#if friends.length === 0}
					<p class="text-[13px] text-ink">Пока некого пригласить</p>
					<p class="text-[12px] leading-5 text-muted">Отправьте ссылку ниже</p>
				{:else}
					<p class="text-[13px] text-ink">Никого не нашлось</p>
					<p class="text-[12px] leading-5 text-muted">Проверьте имя пользователя</p>
				{/if}
			</div>
		{/if}
	</SmoothScroll>

	<div class="px-4 pt-1 pb-4">
		<h3 class="px-1 pb-1.5 text-[12px] font-semibold text-muted">Ссылка-приглашение</h3>
		<div
			onanimationend={(event) => {
				if (event.target === event.currentTarget) linkFlashing = false;
			}}
			class="flex h-11 items-center gap-2.5 rounded-full bg-white/[0.05] pr-1.5 pl-4 {linkFlashing
				? 'link-flash'
				: ''}"
		>
			<Icon name="link" size={14} class="shrink-0 text-muted" />
			<span
				class="min-w-0 flex-1 truncate text-[13px] select-text {invite
					? 'text-ink-secondary'
					: 'text-muted'}"
			>
				{#if invite}
					{#key invite.link}
						<span in:fade={{ duration: 150 }}>{invite.link}</span>
					{/key}
				{:else if linkState.status === 'loading'}
					{#if slowLoading}
						<span in:fade={{ duration: 150 }} class="flex items-center gap-2">
							<Orbit size={12} />
							Создаём ссылку…
						</span>
					{/if}
				{:else}
					Не удалось получить ссылку
				{/if}
			</span>
			<button
				type="button"
				disabled={linkUnavailable}
				onclick={copyLink}
				class="pressable grid h-8 shrink-0 items-center rounded-full px-3.5 text-[12px] font-semibold duration-150 disabled:opacity-50 {copied
					? 'bg-online/10 text-online'
					: 'bg-white/[0.08] text-ink hover:bg-white/[0.12]'}"
			>
				<span
					aria-hidden={copied}
					class="col-start-1 row-start-1 flex items-center justify-center transition-opacity duration-150 {copied
						? 'opacity-0'
						: 'opacity-100'}"
				>
					Копировать
				</span>
				<span
					aria-hidden={!copied}
					class="col-start-1 row-start-1 flex items-center justify-center gap-1.5 transition-opacity duration-150 {copied
						? 'opacity-100'
						: 'opacity-0'}"
				>
					<span class="flex h-3 w-3 shrink-0">
						{#if copied}
							<DrawnCheck size={12} />
						{/if}
					</span>
					Скопировано
				</span>
			</button>
		</div>
		<div class="mt-2 flex items-center gap-1.5 px-1 text-[12px] leading-4 text-muted">
			<span>Действует 7 дней</span>
			{#if canManage}
				<span aria-hidden="true">·</span>
				<button
					type="button"
					aria-expanded={settingsOpen}
					aria-controls="invite-settings"
					onclick={() => (settingsOpen = !settingsOpen)}
					class="grid text-ink-secondary transition-colors duration-150 hover:text-ink"
				>
					<span
						class="col-start-1 row-start-1 transition-opacity duration-150 {settingsOpen
							? 'opacity-0'
							: 'opacity-100'}">Настроить</span
					>
					<span
						class="col-start-1 row-start-1 transition-opacity duration-150 {settingsOpen
							? 'opacity-100'
							: 'opacity-0'}">Скрыть</span
					>
				</button>
			{/if}
		</div>

		{#if canManage}
			<div
				id="invite-settings"
				class="collapsible {settingsOpen ? 'is-open' : ''}"
				inert={!settingsOpen}
			>
				<div>
					<InviteSettingsPanel {serverId} oncreated={useGeneratedLink} />
				</div>
			</div>
		{/if}
	</div>
</Dialog>

{#snippet action(friend: Friend)}
	{#if memberIds.has(friend.id)}
		<span class="flex h-7 items-center px-1 text-[12px] text-muted">На сервере</span>
	{:else if invited.has(friend.id)}
		<span class="flex h-7 items-center gap-1.5 px-1 text-[12px] text-muted">
			<DrawnCheck
				size={13}
				duration={flashing.has(friend.id) ? 320 : 0}
				delay={120}
				class="shrink-0"
			/>
			Отправлено
		</span>
	{:else}
		<button
			type="button"
			disabled={linkUnavailable || !friend.channelId}
			onclick={() => inviteFriend(friend)}
			class="pressable flex h-7 items-center rounded-full bg-white/[0.08] px-3 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12] disabled:opacity-50"
		>
			Пригласить
		</button>
	{/if}
{/snippet}

<style>
	.invite-flash {
		animation: invite-flash 900ms var(--ease-soft);
	}

	.link-flash {
		animation: link-flash 900ms var(--ease-soft);
	}

	@keyframes link-flash {
		0% {
			background-color: rgba(255, 255, 255, 0.14);
		}
		100% {
			background-color: rgba(255, 255, 255, 0.05);
		}
	}

	@keyframes invite-flash {
		0% {
			background-color: rgba(255, 255, 255, 0.1);
		}
		100% {
			background-color: transparent;
		}
	}
</style>
