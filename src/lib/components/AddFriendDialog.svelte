<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';
	import {
		normalizeUsernameQuery,
		usernameQueryMinLength,
		type FriendRelation,
		type UserSearchResult
	} from '$lib/friends/friends';
	import { acceptFriendRequest, searchUsers, sendFriendRequest } from '$lib/friends/channel';
	import { settle } from '$lib/ui/settle';
	import Avatar from './Avatar.svelte';
	import Dialog from './Dialog.svelte';
	import DrawnCheck from './DrawnCheck.svelte';
	import SearchField from './SearchField.svelte';
	import SheetHeader from './SheetHeader.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		friendIds: ReadonlySet<string>;
		onclose: () => void;
	}

	let { friendIds, onclose }: Props = $props();

	type SearchStatus = 'idle' | 'loading' | 'done' | 'rate_limited' | 'failed';
	type SearchView = 'idle' | 'skeleton' | 'results' | 'empty' | 'rate_limited' | 'failed';

	const searchDebounceMs = 200;

	let query = $state('');
	let results = $state<UserSearchResult[]>([]);
	let searchedQuery = $state('');
	let status = $state<SearchStatus>('idle');
	let actionError = $state('');
	const pending = new SvelteSet<string>();
	const justSent = new SvelteSet<string>();

	let searchSequence = 0;

	const skeletonRows = [
		{ opacity: 1, width: 44 },
		{ opacity: 0.85, width: 32 },
		{ opacity: 0.7, width: 52 },
		{ opacity: 0.55, width: 38 },
		{ opacity: 0.42, width: 48 },
		{ opacity: 0.28, width: 30 },
		{ opacity: 0.15, width: 42 }
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
		if (!relation) {
			actionError = 'Не получилось — попробуйте ещё раз';
			return;
		}
		if (relation === 'outgoing' && !prefersReducedMotion.current) justSent.add(userId);
		setRelation(userId, relation);
	}

	function handleAdd(userId: string) {
		void runAction(userId, () => sendFriendRequest(userId));
	}

	function handleAccept(userId: string) {
		void runAction(userId, async () => ((await acceptFriendRequest(userId)) ? 'friend' : null));
	}

	const layerIn = { duration: 180, easing: cubicOut };
	const layerOut = { duration: 120, easing: cubicOut };
</script>

<Dialog label="Добавить друга" wide flush pinTop {onclose}>
	<SheetHeader
		title="Добавить друга"
		subtitle={notice || 'По имени пользователя'}
		subtitleDanger={notice !== ''}
		actionLabel="Готово"
		onaction={onclose}
	/>

	<div class="px-4">
		<SearchField
			bind:value={query}
			placeholder="Имя пользователя"
			prefix="@"
			transform={normalizeUsernameQuery}
		/>
	</div>

	<div class="mt-1 grid h-[356px]">
		{#key layer}
			<div class="col-start-1 row-start-1 min-h-0" in:fade={layerIn} out:fade={layerOut}>
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
</Dialog>

{#snippet resultList()}
	<SmoothScroll
		class="h-full [mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-10px),transparent)]"
		contentClass="px-2 py-2"
	>
		<ul class="flex flex-col gap-0.5">
			{#each shownResults as result (result.id)}
				<li
					class="flex h-11 items-center gap-3 rounded-[10px] px-2.5 transition-colors duration-150 [corner-shape:squircle] hover:bg-white/[0.04]"
				>
					<Avatar name={result.name} size={32} />
					<span class="min-w-0 flex-1 truncate text-[14px] text-muted">
						@<span class="text-ink">{result.username.slice(0, searchedQuery.length)}</span
						>{result.username.slice(searchedQuery.length)}
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
	</SmoothScroll>
{/snippet}

{#snippet skeleton()}
	<ul class="flex flex-col gap-0.5 px-2 py-2" aria-label="Ищем">
		{#each skeletonRows as row, index (index)}
			<li class="flex h-11 items-center gap-3 px-2.5" style="opacity: {row.opacity}">
				<span class="skeleton h-8 w-8 shrink-0 rounded-full"></span>
				<span class="min-w-0 flex-1">
					<span class="skeleton h-2.5 rounded-full" style="width: {row.width}%"></span>
				</span>
				<span class="skeleton h-7 w-[84px] shrink-0 rounded-full"></span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet message()}
	<div class="grid h-full place-items-center px-6 text-center">
		{#key view}
			<div
				class="col-start-1 row-start-1 flex flex-col gap-1"
				in:fade={layerIn}
				out:fade={layerOut}
			>
				{#if view === 'empty'}
					<p class="text-[13px] text-ink">Никого с именем @{searchedQuery}</p>
					<p class="text-[12px] leading-5 text-muted">Проверьте написание</p>
				{:else if view === 'rate_limited'}
					<p class="text-[13px] text-ink">Слишком быстро</p>
					<p class="text-[12px] leading-5 text-muted">Подождите пару секунд и продолжайте</p>
				{:else if view === 'failed'}
					<p class="text-[13px] text-ink">Нет связи с сервером</p>
					<p class="text-[12px] leading-5 text-muted">
						Поиск заработает, когда соединение вернётся
					</p>
				{:else}
					<p class="text-[13px] text-ink">Кого ищем?</p>
					<p class="text-[12px] leading-5 text-muted">Начните вводить имя пользователя</p>
				{/if}
			</div>
		{/key}
	</div>
{/snippet}

{#snippet action(result: UserSearchResult)}
	{#if result.relation === 'none'}
		<button
			type="button"
			disabled={pending.has(result.id)}
			onclick={() => handleAdd(result.id)}
			class="pressable flex h-7 items-center rounded-full bg-white/[0.08] px-3 text-[12px] font-semibold text-ink duration-150 hover:bg-white/[0.12] disabled:opacity-50"
		>
			Добавить
		</button>
	{:else if result.relation === 'incoming'}
		<button
			type="button"
			disabled={pending.has(result.id)}
			onclick={() => handleAccept(result.id)}
			class="pressable flex h-7 items-center rounded-full bg-ink px-3 text-[12px] font-semibold text-bg duration-150 hover:bg-ink-hover disabled:opacity-50"
		>
			Принять
		</button>
	{:else if result.relation === 'outgoing'}
		<span class="flex h-7 items-center gap-1.5 px-1 text-[12px] text-muted">
			<DrawnCheck
				size={13}
				duration={justSent.has(result.id) ? 320 : 0}
				delay={120}
				class="shrink-0"
			/>
			Запрос отправлен
		</span>
	{:else}
		<span class="flex h-7 items-center px-1 text-[12px] text-muted">В друзьях</span>
	{/if}
{/snippet}
