<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { draw } from 'svelte/transition';
	import { createChannel, type ChannelKind } from '$lib/channels/channels';
	import { createInviteLookup } from '$lib/servers/invite-lookup.svelte';
	import { inviteLinkOf, memberCountLabel, recentInvitePreviews } from '$lib/servers/invites';
	import {
		createServer,
		serverNameMaxLength,
		validateServerName,
		type Server
	} from '$lib/servers/servers';
	import { settle } from '$lib/ui/settle';
	import type { AddServerView } from './add-server';
	import Avatar from './Avatar.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import LengthCounter from './LengthCounter.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		initialView?: AddServerView;
		initialValue?: string;
		oncreated: (server: Server) => void;
		onjoined: (server: Server) => void;
		onclose: () => void;
	}

	let { initialView = 'create', initialValue = '', oncreated, onjoined, onclose }: Props = $props();

	const formId = 'add-server-form';
	const closeDelayMs = 450;
	const suggestionLimit = 2;

	const views: { value: AddServerView; label: string }[] = [
		{ value: 'create', label: 'Создать' },
		{ value: 'join', label: 'Присоединиться' }
	];

	const placeholders: Record<AddServerView, string> = {
		create: 'Название сервера',
		join: 'Ссылка или код'
	};

	const notes: Record<AddServerView, string> = {
		create: 'Создавая сервер, вы принимаете правила сообщества',
		join: 'Подойдёт ссылка astronida://invite/… или код из 10 символов'
	};

	const sectionTitles: Record<AddServerView, string> = {
		create: 'Сразу создать',
		join: 'Приглашения из чатов'
	};

	const starterChannels: { kind: ChannelKind; name: string }[] = [
		{ kind: 'text', name: 'общий' },
		{ kind: 'voice', name: 'Голосовой' }
	];

	const chosenStarters = new SvelteSet<ChannelKind>(['text', 'voice']);

	function toggleStarter(kind: ChannelKind) {
		if (chosenStarters.has(kind)) chosenStarters.delete(kind);
		else chosenStarters.add(kind);
	}

	async function createStarterChannels(serverId: string) {
		for (const starter of starterChannels) {
			if (!chosenStarters.has(starter.kind)) continue;
			await createChannel({ serverId, categoryId: null, name: starter.name, kind: starter.kind });
		}
	}

	const suggestions = recentInvitePreviews(suggestionLimit);
	const lookup = createInviteLookup(untrack(() => initialValue));

	let view = $state<AddServerView>(untrack(() => initialView));
	let name = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let done = $state(false);
	let serverError = $state('');

	const busy = $derived(submitting || lookup.joining || done);
	const createError = $derived((submitted ? validateServerName(name) : '') || serverError);
	const error = $derived(view === 'create' ? createError : lookup.error);
	const found = $derived(lookup.found);
	const fieldValue = $derived(view === 'create' ? name : lookup.input);

	const title = $derived(view === 'create' ? 'Новый сервер' : 'Присоединиться');
	const actionLabel = $derived(
		view === 'create' ? 'Создать' : found?.member ? 'Открыть' : 'Вступить'
	);
	const actionDisabled = $derived(view === 'create' ? name.trim() === '' : found === null);
	const subtitle = $derived.by(() => {
		if (error) return error;
		return view === 'join' && lookup.checking ? 'Проверяем приглашение…' : null;
	});

	const identityKey = $derived(
		view === 'create' ? 'create' : found ? `found:${found.serverId}:${found.member}` : 'join'
	);

	function setFieldValue(next: string) {
		if (view === 'create') name = next;
		else lookup.input = next;
	}

	function useSuggestion(code: string) {
		lookup.input = inviteLinkOf(code);
	}

	async function create() {
		submitted = true;
		if (validateServerName(name) || busy) return;
		submitting = true;
		serverError = '';
		const result = await createServer(name);
		if (!result.ok) {
			submitting = false;
			serverError = result.message;
			return;
		}
		await createStarterChannels(result.server.id);
		submitting = false;
		finish(() => oncreated(result.server));
	}

	async function join() {
		if (busy) return;
		const result = await lookup.join();
		if (result?.ok) finish(() => onjoined(result.server));
	}

	function finish(complete: () => void) {
		done = true;
		setTimeout(complete, closeDelayMs);
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void (view === 'create' ? create() : join());
	}
</script>

<Dialog label={title} wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		{title}
		{subtitle}
		subtitleDanger={error !== ''}
		cancelLabel="Отмена"
		cancelDisabled={busy}
		oncancel={onclose}
		{actionLabel}
		actionForm={formId}
		{actionDisabled}
		actionBusy={submitting || lookup.joining}
		actionDone={done}
	/>

	<form id={formId} class="flex h-[396px] flex-col px-4 pt-1 pb-4" onsubmit={handleSubmit}>
		<SegmentedControl label="Сервер" options={views} bind:value={view} disabled={busy} />

		<div class="mt-4 flex flex-col items-center">
			<div class="grid h-[72px] w-[72px]">
				{#key identityKey}
					<div class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
						{#if view === 'create'}
							<button
								type="button"
								aria-label="Добавить фото"
								title="Скоро"
								class="pressable flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-line text-muted will-change-transform duration-200 hover:border-line-strong hover:text-ink"
							>
								<Icon name="camera" size={22} />
							</button>
						{:else if found}
							<Avatar name={found.serverName} size={72} />
						{:else}
							<span
								class="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/[0.05] text-muted {lookup.checking
									? 'animate-pulse'
									: ''}"
							>
								<Icon name="link" size={22} />
							</span>
						{/if}
					</div>
				{/key}
			</div>

			<div class="mt-2 grid h-5 w-full grid-cols-1 justify-items-center px-4">
				{#key identityKey}
					<span
						class="col-start-1 row-start-1 max-w-full truncate text-[13px] leading-5 {view ===
							'create' || found
							? 'text-ink-secondary'
							: 'text-muted'}"
						in:settle
						out:settle={{ duration: 100 }}
					>
						{#if view === 'create'}
							Добавить фото
						{:else if found}
							<span class="font-semibold text-ink">{found.serverName}</span>
							· {found.member ? 'вы уже участник' : memberCountLabel(found.memberCount)}
						{:else}
							По приглашению
						{/if}
					</span>
				{/key}
			</div>
		</div>

		<label
			class="relative mt-3 grid h-12 rounded-[14px] bg-white/[0.05] transition-colors duration-150 [corner-shape:squircle] focus-within:bg-white/[0.07]"
		>
			<input
				bind:value={() => fieldValue, setFieldValue}
				type="text"
				maxlength={view === 'create' ? serverNameMaxLength : undefined}
				aria-label={placeholders[view]}
				aria-invalid={error !== ''}
				spellcheck="false"
				autocomplete="off"
				disabled={busy}
				class="col-start-1 row-start-1 h-12 w-full bg-transparent pr-16 pl-4 text-[14px] text-ink outline-none"
			/>
			{#if view === 'create'}
				<span class="pointer-events-none absolute inset-y-0 right-4 flex items-center">
					<LengthCounter value={name} max={serverNameMaxLength} />
				</span>
			{/if}
			{#if fieldValue === ''}
				{#key view}
					<span
						aria-hidden="true"
						class="pointer-events-none col-start-1 row-start-1 flex items-center px-4 text-[14px] text-muted"
						in:settle
						out:settle={{ duration: 100 }}
					>
						{placeholders[view]}
					</span>
				{/key}
			{/if}
		</label>

		<div class="mt-2 grid h-4 grid-cols-1 px-4">
			{#key view}
				<p
					class="col-start-1 row-start-1 truncate text-[12px] leading-4 text-muted"
					in:settle
					out:settle={{ duration: 100 }}
				>
					{notes[view]}
				</p>
			{/key}
		</div>

		<div class="mt-5 grid min-h-0 flex-1 grid-cols-1">
			{#key view}
				<section
					class="col-start-1 row-start-1 flex min-h-0 flex-col"
					in:settle
					out:settle={{ duration: 100 }}
				>
					<h3 class="px-1 pb-1.5 text-[12px] leading-4 font-semibold text-muted">
						{sectionTitles[view]}
					</h3>
					{#if view === 'create'}
						<ul class="flex flex-col gap-0.5">
							{#each starterChannels as starter (starter.kind)}
								{@const checked = chosenStarters.has(starter.kind)}
								<li>
									<button
										type="button"
										role="checkbox"
										aria-checked={checked}
										disabled={busy}
										onclick={() => toggleStarter(starter.kind)}
										class="-mx-1 flex h-10 w-[calc(100%+0.5rem)] items-center gap-3 rounded-[10px] px-2 text-left transition-colors duration-150 [corner-shape:squircle] enabled:hover:bg-white/[0.04]"
									>
										<Icon name={starter.kind} size={16} class="text-muted" />
										<span
											class="min-w-0 flex-1 truncate text-[13px] transition-colors duration-150 {checked
												? 'text-ink'
												: 'text-ink-secondary'}"
										>
											{starter.name}
										</span>
										<span
											class="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 {checked
												? 'border-transparent'
												: 'border-white/20'}"
										>
											<span
												class="absolute inset-0 rounded-full bg-ink transition-[scale,opacity] duration-180 ease-soft {checked
													? 'scale-100 opacity-100'
													: 'scale-60 opacity-0'}"
											></span>
											{#if checked}
												<svg
													width="11"
													height="11"
													viewBox="0 0 16 16"
													fill="none"
													stroke="currentColor"
													stroke-width="2.4"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"
													class="relative text-bg"
												>
													<path
														d="M3.25 8.5 6.5 11.75 12.75 4.75"
														in:draw={{ duration: prefersReducedMotion.current ? 0 : 220 }}
													/>
												</svg>
											{/if}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else if suggestions.length > 0}
						<ul class="flex flex-col gap-0.5">
							{#each suggestions as suggestion (suggestion.code)}
								{@const chosen = lookup.input === inviteLinkOf(suggestion.code)}
								<li
									class="-mx-1 flex h-11 items-center gap-3 rounded-[10px] px-2 [corner-shape:squircle]"
								>
									<Avatar name={suggestion.preview.serverName} size={32} />
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="truncate text-[13px] leading-4 font-semibold text-ink">
											{suggestion.preview.serverName}
										</span>
										<span class="text-[12px] leading-4 text-muted">
											{memberCountLabel(suggestion.preview.memberCount)}
										</span>
									</span>
									<button
										type="button"
										disabled={chosen || busy}
										onclick={() => useSuggestion(suggestion.code)}
										class="pressable grid h-7 shrink-0 items-center rounded-full px-3 text-[12px] font-semibold duration-150 {chosen
											? 'text-muted'
											: 'bg-white/[0.08] text-ink hover:bg-white/[0.12]'}"
									>
										{#key chosen}
											<span class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
												{chosen ? 'Выбрано' : 'Вставить'}
											</span>
										{/key}
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="px-1 pt-1 text-[13px] leading-5 text-muted">
							Приглашения, которые вам пришлют, появятся здесь
						</p>
					{/if}
				</section>
			{/key}
		</div>
	</form>
</Dialog>
