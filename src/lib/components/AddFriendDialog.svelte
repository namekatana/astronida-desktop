<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';
	import {
		normalizeUsernameQuery,
		usernameQueryMinLength,
		type FriendRelation,
		type UserSearchResult
	} from '$lib/friends/friends';
	import { acceptFriendRequest, searchUsers, sendFriendRequest } from '$lib/friends/channel';
	import { initials } from '$lib/ui/initials';
	import Dialog from './Dialog.svelte';
	import FriendSearchIllustration from './FriendSearchIllustration.svelte';
	import Icon from './Icon.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		friendIds: ReadonlySet<string>;
		onclose: () => void;
	}

	let { friendIds, onclose }: Props = $props();

	type SearchStatus = 'idle' | 'loading' | 'done' | 'rate_limited' | 'failed';

	const searchDebounceMs = 200;

	let query = $state('');
	let results = $state<UserSearchResult[]>([]);
	let searchedQuery = $state('');
	let status = $state<SearchStatus>('idle');
	let actionError = $state('');
	const pending = new SvelteSet<string>();

	let searchSequence = 0;

	type SearchView = 'idle' | 'skeleton' | 'results' | 'empty' | 'rate_limited' | 'failed';

	const skeletonRows = [
		{ opacity: 1, nameWidth: 52, usernameWidth: 34 },
		{ opacity: 0.7, nameWidth: 40, usernameWidth: 28 },
		{ opacity: 0.4, nameWidth: 58, usernameWidth: 38 }
	];

	const view = $derived.by((): SearchView => {
		if (results.length > 0) return 'results';
		if (status === 'loading') return 'skeleton';
		if (status === 'done') return 'empty';
		return status;
	});

	const shownResults = $derived(
		results.map((result): UserSearchResult =>
			friendIds.has(result.id) ? { ...result, relation: 'friend' } : result
		)
	);

	const layer = $derived(view === 'results' || view === 'skeleton' ? view : 'message');

	const notice = $derived(
		actionError ||
			(status === 'rate_limited' && results.length > 0 ? 'Слишком быстро — подождите пару секунд' : '')
	);

	$effect(() => {
		const current = query;
		const sequence = ++searchSequence;

		if (current.length < usernameQueryMinLength) {
			results = [];
			searchedQuery = '';
			status = 'idle';
			return;
		}

		untrack(() => {
			if (status === 'idle') status = 'loading';
		});

		const timer = setTimeout(() => void runSearch(current, sequence), searchDebounceMs);
		return () => clearTimeout(timer);
	});

	async function runSearch(current: string, sequence: number) {
		const outcome = await searchUsers(current);
		if (sequence !== searchSequence) return;

		if (outcome.ok) {
			results = outcome.results;
			searchedQuery = current;
			status = 'done';
		} else {
			status = outcome.reason;
		}
	}

	function setRelation(userId: string, relation: FriendRelation) {
		results = results.map((result) => (result.id === userId ? { ...result, relation } : result));
	}

	async function runAction(userId: string, action: () => Promise<FriendRelation | null>) {
		if (pending.has(userId)) return;
		pending.add(userId);
		actionError = '';
		const relation = await action();
		pending.delete(userId);
		if (relation) setRelation(userId, relation);
		else actionError = 'Не получилось — попробуйте ещё раз чуть позже';
	}

	function handleAdd(userId: string) {
		void runAction(userId, () => sendFriendRequest(userId));
	}

	function handleAccept(userId: string) {
		void runAction(userId, async () => ((await acceptFriendRequest(userId)) ? 'friend' : null));
	}

	const layerIn = { duration: 180, easing: cubicOut };
	const layerOut = { duration: 120, easing: cubicOut };

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<Dialog label="Добавить друга" wide {onclose}>
	<h2 class="text-center text-[15px] font-semibold text-ink">Добавить друга</h2>
	<p class="mx-auto mt-1 max-w-[300px] text-center text-[13px] leading-5 text-ink-secondary">
		Найдите человека по имени пользователя — он получит запрос и сможет его принять
	</p>

	<div class="mt-6">
		<PillInput
			label="Имя пользователя"
			prefix="@"
			bind:value={query}
			transform={normalizeUsernameQuery}
		>
			{#snippet trailing()}
				<span class="flex text-muted"><Icon name="search" size={16} /></span>
			{/snippet}
		</PillInput>
	</div>

	<p
		class="flex h-8 items-center justify-center text-center text-[12px] text-danger transition-opacity duration-200 {notice
			? 'opacity-100'
			: 'opacity-0'}"
	>
		{notice}
	</p>

	<div class="-mx-2 grid h-[264px]">
		{#key layer}
			<div
				class="col-start-1 row-start-1 min-h-0"
				in:fade={layerIn}
				out:fade={layerOut}
			>
				{#if layer === 'results'}
					{@render resultList()}
				{:else if layer === 'skeleton'}
					{@render skeleton()}
				{:else}
					{@render message()}
				{/if}
			</div>
		{/key}
	</div>

	<div class="flex justify-center pt-4">
		<button
			type="button"
			onclick={onclose}
			class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink"
		>
			Закрыть
		</button>
	</div>
</Dialog>

{#snippet resultList()}
	<div class="scrollbar-none h-full overflow-y-auto">
		<ul class="flex flex-col gap-0.5">
			{#each shownResults as result (result.id)}
				<li class="flex h-12 items-center gap-3 rounded-lg px-2.5">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
					>
						{initials(result.name)}
					</span>

					<span class="min-w-0 flex-1">
						<span class="block truncate text-[13px] text-ink">{result.name}</span>
						<span class="block truncate text-[12px] text-muted">
							@<span class="text-ink-secondary">{result.username.slice(0, searchedQuery.length)}</span
							>{result.username.slice(searchedQuery.length)}
						</span>
					</span>

					<span class="grid shrink-0 justify-items-end">
						{#key result.relation}
							<span class="col-start-1 row-start-1 flex" in:settle out:settle={{ duration: 100 }}>
								{@render action(result)}
							</span>
						{/key}
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/snippet}

{#snippet skeleton()}
	<ul class="flex flex-col gap-0.5" aria-label="Ищем">
		{#each skeletonRows as row, index (index)}
			<li class="flex h-12 items-center gap-3 px-2.5" style="opacity: {row.opacity}">
				<span class="skeleton h-8 w-8 shrink-0 rounded-full"></span>
				<span class="flex min-w-0 flex-1 flex-col gap-2">
					<span class="skeleton h-2.5 rounded-full" style="width: {row.nameWidth}%"></span>
					<span class="skeleton h-2 rounded-full" style="width: {row.usernameWidth}%"></span>
				</span>
				<span class="skeleton h-8 w-[92px] shrink-0 rounded-full"></span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet message()}
	<div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
		<FriendSearchIllustration />
		<div class="grid">
			{#key view}
				<div
					class="col-start-1 row-start-1 flex flex-col gap-1"
					in:fade={layerIn}
					out:fade={layerOut}
				>
					{#if view === 'empty'}
						<p class="text-[13px] text-ink">Никого с именем @{searchedQuery}…</p>
						<p class="text-[12px] leading-5 text-muted">
							Проверьте написание — точное имя пользователя можно спросить у друга
						</p>
					{:else if view === 'rate_limited'}
						<p class="text-[13px] text-ink">Слишком быстро</p>
						<p class="text-[12px] leading-5 text-muted">Подождите пару секунд и продолжайте</p>
					{:else if view === 'failed'}
						<p class="text-[13px] text-ink">Нет связи с сервером</p>
						<p class="text-[12px] leading-5 text-muted">
							Поиск заработает, как только соединение вернётся
						</p>
					{:else}
						<p class="text-[13px] text-ink">Кого ищем?</p>
						<p class="text-[12px] leading-5 text-muted">Начните вводить имя пользователя</p>
					{/if}
				</div>
			{/key}
		</div>
	</div>
{/snippet}

{#snippet action(result: UserSearchResult)}
	{#if result.relation === 'none'}
		<button
			type="button"
			disabled={pending.has(result.id)}
			onclick={() => handleAdd(result.id)}
			class="pressable flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-ink duration-150 hover:border-line-strong disabled:opacity-50"
		>
			<Icon name="user-plus" size={14} />
			Добавить
		</button>
	{:else if result.relation === 'incoming'}
		<button
			type="button"
			disabled={pending.has(result.id)}
			onclick={() => handleAccept(result.id)}
			class="pressable flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-medium text-bg duration-150 hover:bg-ink-hover disabled:opacity-50"
		>
			<Icon name="check" size={14} />
			Принять
		</button>
	{:else if result.relation === 'outgoing'}
		<span class="flex h-8 items-center gap-1.5 px-1 text-[12px] text-muted">
			<Icon name="clock" size={14} />
			Запрос отправлен
		</span>
	{:else}
		<span class="flex h-8 items-center gap-1.5 px-1 text-[12px] text-muted">
			<Icon name="user-check" size={14} />
			В друзьях
		</span>
	{/if}
{/snippet}

<style>
	.skeleton {
		display: block;
		background-color: var(--color-surface-raised);
		background-image: linear-gradient(
			100deg,
			transparent 35%,
			rgba(255, 255, 255, 0.07) 50%,
			transparent 65%
		);
		background-size: 640px 100%;
		background-repeat: repeat-x;
		background-attachment: fixed;
		animation: skeleton-sweep 1.4s linear infinite;
	}

	@keyframes skeleton-sweep {
		from {
			background-position: -640px 0;
		}
		to {
			background-position: 0 0;
		}
	}

	@keyframes skeleton-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			background-image: none;
			animation: skeleton-pulse 1.4s ease-in-out infinite;
		}
	}
</style>
