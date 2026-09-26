<script lang="ts">
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade, scale, type TransitionConfig } from 'svelte/transition';
	import type { Friend } from '$lib/friends/friends';
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';
	import { panelLimits } from '$lib/ui/panel-widths.svelte';
	import { pop } from '$lib/ui/pop';
	import { reveal } from '$lib/ui/reveal';
	import ConnectionTitle from './ConnectionTitle.svelte';
	import Icon from './Icon.svelte';
	import MemberItem from './MemberItem.svelte';
	import ResizeHandle from './ResizeHandle.svelte';

	interface Props {
		friends: Member[];
		requests: Friend[];
		freshRequestIds: ReadonlySet<string>;
		freshFriendIds: ReadonlySet<string>;
		selectedFriendId: string | null;
		unreadByFriend: Record<string, number>;
		width: number;
		onselect: (friendId: string) => void;
		onprefetch: (friendId: string) => void;
		onaddfriend: () => void;
		onaccept: (userId: string) => Promise<boolean>;
		ondecline: (userId: string) => Promise<boolean>;
		onrequestseen: (userId: string) => void;
	}

	let {
		friends,
		requests,
		freshRequestIds,
		freshFriendIds,
		selectedFriendId,
		unreadByFriend,
		width = $bindable(),
		onselect,
		onprefetch,
		onaddfriend,
		onaccept,
		ondecline,
		onrequestseen
	}: Props = $props();

	let pendingCollapsed = $state(false);
	const answering = new SvelteSet<string>();

	async function answer(userId: string, respond: (userId: string) => Promise<boolean>) {
		if (answering.has(userId)) return;
		answering.add(userId);
		await respond(userId);
		answering.delete(userId);
	}

	type FriendListItem =
		| { kind: 'heading'; key: string; label: string; count: number }
		| { kind: 'friend'; key: string; member: Member };

	const moveDuration = 280;

	const total = $derived(friends.length);

	const listItems = $derived.by((): FriendListItem[] => {
		const groups = [
			{ label: 'В сети', members: friends.filter((f) => f.online) },
			{ label: 'Не в сети', members: friends.filter((f) => !f.online) }
		].filter((group) => group.members.length > 0);

		return groups.flatMap((group, position): FriendListItem[] => [
			{
				kind: 'heading',
				key: `heading:${position}`,
				label: group.label,
				count: group.members.length
			},
			...group.members.map((member): FriendListItem => ({
				kind: 'friend',
				key: member.id,
				member
			}))
		]);
	});

	function enter(node: Element, item: FriendListItem): TransitionConfig {
		if (item.kind === 'heading') return fade(node, { delay: 160, duration: 140 });
		return pop(node, { y: 6, duration: freshFriendIds.has(item.key) ? 240 : 0 });
	}

	function leave(node: Element, item: FriendListItem): TransitionConfig {
		return fade(node, { duration: item.kind === 'heading' ? 0 : 120 });
	}

	const rowElements = $state<Record<string, HTMLDivElement | null>>({});
	let highlightY = $state(0);
	let highlightVisible = $state(false);
	let highlightMove = $state<'none' | 'select' | 'reflow'>('none');
	let highlightedId: string | null = null;

	$effect(() => {
		void listItems;
		const row = selectedFriendId ? rowElements[selectedFriendId] : null;

		if (!row) {
			highlightVisible = false;
			highlightedId = null;
			return;
		}

		const wasVisible = untrack(() => highlightVisible);
		highlightMove = !wasVisible ? 'none' : highlightedId === selectedFriendId ? 'reflow' : 'select';
		highlightY = row.offsetTop;
		highlightVisible = true;
		highlightedId = selectedFriendId;
	});

	const highlightTranslate = $derived.by(() => {
		if (prefersReducedMotion.current) return '';
		if (highlightMove === 'select') return 'translate 200ms var(--ease-move), ';
		if (highlightMove === 'reflow') {
			return `translate ${moveDuration}ms cubic-bezier(0.645, 0.045, 0.355, 1), `;
		}
		return '';
	});

	const highlightTransition = $derived(
		`${highlightTranslate}scale 220ms var(--ease-soft), opacity 220ms ease-out`
	);
</script>

<aside class="panel relative flex shrink-0 flex-col" style="width: {width}px">
	<div class="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
		<ConnectionTitle title="Друзья" />
		<span class="text-[12px] text-muted">{total}</span>
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<div class="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
		<button
			type="button"
			onclick={onaddfriend}
			class="pressable mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-line text-[13px] text-muted duration-200 hover:border-line-strong hover:text-ink"
		>
			<Icon name="plus" size={14} />
			Добавить друга
		</button>

		{#snippet heading(label: string, count: number, first: boolean)}
			<div class={first ? '' : 'pt-2'}>
				<div
					class="flex h-7 items-center px-2 text-[11px] font-medium tracking-[0.1em] text-muted uppercase"
				>
					{label} — {count}
				</div>
			</div>
		{/snippet}

		{#if requests.length > 0}
			<div class="pb-3" transition:reveal>
				<section
					aria-label="Запросы в друзья"
					class="rounded-xl border border-surface-line bg-white/[0.03] p-1"
				>
					<button
						type="button"
						aria-expanded={!pendingCollapsed}
						onclick={() => (pendingCollapsed = !pendingCollapsed)}
						class="flex h-8 w-full items-center gap-1.5 px-2 text-[11px] font-medium tracking-[0.1em] text-ink-secondary uppercase transition-colors duration-150 hover:text-ink"
					>
						<Icon
							name="chevron"
							size={12}
							class="transition-transform duration-200 ease-soft {pendingCollapsed ? '-rotate-90' : ''}"
						/>
						<span>Запросы</span>
						<span
							class="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1.5 text-[10px] font-semibold tracking-normal text-bg tabular-nums"
						>
							{requests.length}
						</span>
					</button>

					<div class="collapsible {pendingCollapsed ? '' : 'is-open'}" inert={pendingCollapsed}>
						<div>
							<div class="flex flex-col gap-0.5">
								{#each requests as request (request.id)}
									<div
										transition:reveal
										onanimationend={(event) => {
											if (event.animationName.endsWith('request-glow')) onrequestseen(request.id);
										}}
										class="flex h-12 items-center gap-2.5 rounded-lg px-2 transition-[opacity] duration-150 {freshRequestIds.has(
											request.id
										)
											? 'request-fresh'
											: ''} {answering.has(request.id) ? 'opacity-50' : ''}"
									>
										<span
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-ink"
										>
											{initials(request.name)}
										</span>
										<span class="min-w-0 flex-1">
											<span class="block truncate text-[13px] text-ink">@{request.username}</span>
											<span class="block truncate text-[11px] text-muted">
												хочет добавить вас в друзья
											</span>
										</span>
										<div class="flex shrink-0 items-center gap-1.5">
											<button
												type="button"
												aria-label="Принять"
												title="Принять"
												disabled={answering.has(request.id)}
												onclick={() => answer(request.id, onaccept)}
												class="pressable flex h-7 w-7 items-center justify-center rounded-full bg-ink text-bg duration-150 hover:bg-ink-hover"
											>
												<Icon name="check" size={14} />
											</button>
											<button
												type="button"
												aria-label="Отклонить"
												title="Отклонить"
												disabled={answering.has(request.id)}
												onclick={() => answer(request.id, ondecline)}
												class="pressable flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted duration-150 hover:border-danger hover:text-danger"
											>
												<Icon name="close" size={14} />
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</section>
			</div>
		{/if}

		<div class="relative flex flex-col gap-0.5">
			<span
				aria-hidden="true"
				class="absolute inset-x-0 top-0 h-10 rounded-lg bg-white/[0.06] {highlightVisible
					? 'opacity-100'
					: 'opacity-0'}"
				style="translate: 0 {highlightY}px; scale: {highlightVisible
					? 1
					: 0.96}; transition: {highlightTransition};"
			></span>

			{#each listItems as item (item.key)}
				<div
					bind:this={rowElements[item.key]}
					class="relative"
					animate:flip={{
						duration: prefersReducedMotion.current ? 0 : moveDuration,
						easing: cubicInOut
					}}
					in:enter={item}
					out:leave={item}
				>
					{#if item.kind === 'heading'}
						{@render heading(item.label, item.count, item.key === 'heading:0')}
					{:else}
						<button
							type="button"
							aria-current={item.member.id === selectedFriendId ? 'true' : undefined}
							onclick={() => onselect(item.member.id)}
							onpointerenter={() => onprefetch(item.member.id)}
							onfocus={() => onprefetch(item.member.id)}
							class="relative block w-full rounded-lg text-left"
						>
							<MemberItem member={item.member} active={item.member.id === selectedFriendId} />
							{#if (unreadByFriend[item.member.id] ?? 0) > 0}
								<span
									class="absolute top-1/2 right-2.5 flex h-[18px] min-w-[18px] -translate-y-1/2 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-bg tabular-nums"
									transition:scale={{ start: 0.8, duration: 160, easing: cubicOut }}
								>
									{unreadByFriend[item.member.id]}
								</span>
							{/if}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<ResizeHandle side="right" bind:width min={panelLimits.min} max={panelLimits.max} />
</aside>

<style>
	.request-fresh {
		animation: request-glow 1.2s var(--ease-soft);
	}

	@keyframes request-glow {
		from {
			background-color: rgba(255, 255, 255, 0.1);
		}
		to {
			background-color: transparent;
		}
	}
</style>
