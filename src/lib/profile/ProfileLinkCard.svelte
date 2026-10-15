<script lang="ts">
	import { avatarIn, type ProfileRelation } from './profile';
	import {
		lookupProfileLink,
		type ProfileLinkHandlers,
		type ProfileLinkResult
	} from './profile-link-lookup';
	import { settle } from '$lib/ui/settle';
	import Avatar from './Avatar.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import NightSky from '$lib/media/NightSky.svelte';

	interface Props {
		username: string;
		handlers: ProfileLinkHandlers;
	}

	let { username, handlers }: Props = $props();

	let remote = $state<ProfileLinkResult | null>(null);
	let attempt = $state(0);
	let root = $state<HTMLDivElement | null>(null);

	const local = $derived(handlers.lookup(username));
	const person = $derived(local ?? (remote?.ok ? remote.person : null));
	const view = $derived(person ? 'ready' : remote && !remote.ok ? remote.reason : 'loading');
	const action = $derived(
		view === 'ready'
			? 'open'
			: view === 'not_found'
				? 'unavailable'
				: view === 'failed'
					? 'retry'
					: 'loading'
	);

	const relationLabels: Record<ProfileRelation, string> = {
		self: 'Это вы',
		friend: 'В друзьях',
		incoming: 'Хочет добавить вас в друзья',
		outgoing: 'Запрос в друзья отправлен',
		none: 'Профиль'
	};

	const actionLabels: Record<string, string> = {
		open: 'Открыть профиль',
		unavailable: 'Недоступно',
		retry: 'Повторить'
	};

	$effect(() => {
		const current = username;
		void attempt;
		if (local) return;
		let active = true;
		remote = null;
		void lookupProfileLink(current).then((result) => {
			if (active) remote = result;
		});
		return () => {
			active = false;
		};
	});

	function runAction() {
		if (action === 'retry') attempt += 1;
		else if (person) handlers.open(person.target, avatarIn(root));
	}
</script>

<div
	bind:this={root}
	class="mt-1.5 mb-1 w-[300px] max-w-full rounded-plate border border-tint/10 bg-surface p-1.5 [corner-shape:squircle]"
>
	<NightSky
		class="aspect-[4/1] w-full rounded-row transition-opacity duration-200 ease-soft [corner-shape:squircle] {view ===
		'not_found'
			? 'opacity-40'
			: ''}"
	/>

	<div class="relative -mt-6 grid grid-cols-1 px-3">
		{#key view}
			<div
				in:settle
				out:settle={{ duration: 100 }}
				class="col-start-1 row-start-1 flex min-w-0 flex-col items-start"
			>
				{#if person}
					<Avatar
						name={person.target.name}
						size={48}
						userId={person.target.id}
						avatarId={person.target.avatarId}
						class="ring-4 ring-surface"
					/>
					<p class="mt-2 h-5 w-full truncate text-[15px] leading-5 font-semibold text-ink">
						@{person.target.username}
					</p>
					<p class="h-4 w-full truncate text-[12px] leading-4 text-muted">
						{relationLabels[person.relation]}
					</p>
				{:else if view === 'loading'}
					<span class="skeleton size-12 rounded-full ring-4 ring-surface"></span>
					<p class="mt-2 h-5 w-full truncate text-[15px] leading-5 font-semibold text-ink">
						@{username}
					</p>
					<span class="flex h-4 items-center">
						<span class="skeleton h-2 w-24 rounded-full"></span>
					</span>
				{:else}
					{@const missing = view === 'not_found'}
					<span
						class="grid size-12 place-items-center rounded-full bg-surface-raised text-muted ring-4 ring-surface"
					>
						<Icon name={missing ? 'user' : 'info'} size={18} />
					</span>
					<p class="mt-2 h-5 w-full truncate text-[15px] leading-5 font-semibold text-ink-secondary">
						{missing ? 'Профиль не найден' : 'Не удалось загрузить'}
					</p>
					<p class="h-4 w-full truncate text-[12px] leading-4 text-muted">
						{missing ? `@${username} больше не существует` : 'Проверьте соединение'}
					</p>
				{/if}
			</div>
		{/key}
	</div>

	<div class="px-1.5 pt-3 pb-1.5">
		{#if action === 'loading'}
			<span class="skeleton block h-9 w-full rounded-full"></span>
		{:else}
			<button
				type="button"
				disabled={action === 'unavailable'}
				onclick={runAction}
				class="grid h-9 w-full place-items-center rounded-full text-[13px] font-semibold transition-colors duration-150 {action ===
				'unavailable'
					? 'cursor-default bg-fill-faint text-muted'
					: 'pressable bg-fill-raised text-ink hover:bg-fill-strong'}"
			>
				{#key action}
					<span in:settle out:settle={{ duration: 100 }} class="col-start-1 row-start-1">
						{actionLabels[action]}
					</span>
				{/key}
			</button>
		{/if}
	</div>
</div>
