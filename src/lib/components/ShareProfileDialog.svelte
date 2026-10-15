<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Friend } from '$lib/friends/friends';
	import { messageMaxLength } from '$lib/messages/messages';
	import type { UserStatus } from '$lib/presence/status';
	import type { ProfileTarget } from '$lib/profile/profile';
	import Avatar from './Avatar.svelte';
	import CheckCircle from './CheckCircle.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import SearchField from './SearchField.svelte';
	import SheetHeader from './SheetHeader.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	type ShareFriend = Friend & { online: boolean; status?: UserStatus };

	interface Props {
		target: ProfileTarget;
		friends: ShareFriend[];
		onshare: (channelIds: string[], comment: string) => void;
		onclose: () => void;
	}

	let { target, friends, onshare, onclose }: Props = $props();

	const formId = 'share-profile-form';
	const maxTargets = 10;
	const closeAfterSentMs = 450;

	let query = $state('');
	let comment = $state('');
	let sent = $state(false);
	let closeTimer: ReturnType<typeof setTimeout> | null = null;
	const selected = new SvelteSet<string>();

	const candidates = $derived(
		friends
			.filter((friend) => friend.channelId !== null && friend.id !== target.id)
			.sort(
				(a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username)
			)
	);
	const needle = $derived(query.trim().replace(/^@/, '').toLowerCase());
	const shown = $derived(
		needle === ''
			? candidates
			: candidates.filter(
					(friend) =>
						friend.username.includes(needle) || friend.name.toLowerCase().includes(needle)
				)
	);
	const limitReached = $derived(selected.size >= maxTargets);
	const subtitle = $derived(
		selected.size === 0
			? `@${target.username}`
			: limitReached
				? `Выбрано: ${selected.size} — это максимум`
				: `Выбрано: ${selected.size}`
	);

	$effect(() => () => {
		if (closeTimer) clearTimeout(closeTimer);
	});

	function toggle(channelId: string) {
		if (sent) return;
		if (selected.has(channelId)) selected.delete(channelId);
		else if (!limitReached) selected.add(channelId);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (selected.size === 0 || sent) return;
		onshare([...selected], comment);
		sent = true;
		closeTimer = setTimeout(onclose, closeAfterSentMs);
	}
</script>

<Dialog label="Поделиться профилем @{target.username}" wide flush pinTop locked={sent} {onclose}>
	<SheetHeader
		title="Поделиться профилем"
		{subtitle}
		cancelLabel="Отмена"
		cancelDisabled={sent}
		oncancel={onclose}
		actionLabel="Отправить"
		actionForm={formId}
		actionDisabled={selected.size === 0}
		actionDone={sent}
	/>

	<div class="px-4">
		<SearchField bind:value={query} placeholder="Поиск друзей" />
	</div>

	<SmoothScroll
		class="mt-1 h-[272px] [mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-10px),transparent)]"
		contentClass="flex min-h-full flex-col px-2 py-2"
	>
		{#if shown.length > 0}
			<section>
				<h3 class="px-3 pt-2 pb-1 text-[12px] font-semibold text-muted">Друзья</h3>
				<ul class="flex flex-col gap-0.5">
					{#each shown as friend (friend.id)}
						{@const channelId = friend.channelId ?? ''}
						{@const checked = selected.has(channelId)}
						{@const blocked = !checked && limitReached}
						<li>
							<button
								type="button"
								role="checkbox"
								aria-checked={checked}
								disabled={blocked || sent}
								onclick={() => toggle(channelId)}
								class="flex h-11 w-full items-center gap-3 rounded-row px-2.5 text-left transition-[background-color,opacity] duration-150 [corner-shape:squircle] disabled:cursor-default {checked
									? 'bg-fill'
									: 'enabled:hover:bg-fill-faint'} {blocked ? 'opacity-40' : ''}"
							>
								<Avatar
									name={friend.name}
									size={32}
									userId={friend.id}
									avatarId={friend.avatarId}
									online={friend.online}
									status={friend.status}
								/>
								<span class="min-w-0 flex-1 truncate text-[14px] text-ink">@{friend.username}</span>
								<CheckCircle {checked} />
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<div class="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
				{#if candidates.length > 0}
					<p class="text-[13px] text-ink">Ничего не нашлось</p>
					<p class="text-[12px] leading-5 text-muted">Проверьте ник друга</p>
				{:else}
					<p class="text-[13px] text-ink">Пока не с кем поделиться</p>
					<p class="text-[12px] leading-5 text-muted">Профилем можно поделиться только с друзьями</p>
				{/if}
			</div>
		{/if}
	</SmoothScroll>

	<form id={formId} class="px-4 pt-1 pb-4" onsubmit={submit}>
		<div
			class="rounded-plate bg-fill px-3.5 pt-2.5 pb-2 transition-colors duration-150 [corner-shape:squircle] focus-within:bg-fill-raised"
		>
			<p class="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-muted">
				<Icon name="share" size={12} class="shrink-0" />
				Профиль
				<span class="min-w-0 truncate font-semibold text-ink-secondary">@{target.username}</span>
			</p>
			<input
				bind:value={comment}
				type="text"
				maxlength={messageMaxLength}
				placeholder="Добавить комментарий…"
				aria-label="Комментарий"
				disabled={sent}
				class="mt-1.5 h-6 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
			/>
		</div>
	</form>
</Dialog>
