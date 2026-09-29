<script lang="ts">
	import { untrack } from 'svelte';
	import { createInviteLookup } from '$lib/servers/invite-lookup.svelte';
	import { memberCountLabel } from '$lib/servers/invites';
	import { createServer, validateServerName, type Server } from '$lib/servers/servers';
	import type { AddServerView } from './add-server';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import PillButton from './PillButton.svelte';
	import PillInput from './PillInput.svelte';
	import SegmentedControl from './SegmentedControl.svelte';

	interface Props {
		initialView?: AddServerView;
		initialValue?: string;
		oncreated: (server: Server) => void;
		onjoined: (server: Server) => void;
		onclose: () => void;
	}

	let { initialView = 'create', initialValue = '', oncreated, onjoined, onclose }: Props = $props();

	type Footnote =
		| { kind: 'error'; text: string }
		| { kind: 'rules' }
		| { kind: 'hint' }
		| { kind: 'checking' }
		| { kind: 'found'; serverId: string };

	const views: { value: AddServerView; label: string }[] = [
		{ value: 'create', label: 'Создать' },
		{ value: 'join', label: 'Присоединиться' }
	];

	const lookup = createInviteLookup(untrack(() => initialValue));

	let view = $state<AddServerView>(untrack(() => initialView));
	let name = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let serverError = $state('');

	const busy = $derived(submitting || lookup.joining);
	const createError = $derived((submitted ? validateServerName(name) : '') || serverError);
	const error = $derived(view === 'create' ? createError : lookup.error);
	const found = $derived(lookup.found);

	const submitLabel = $derived(
		view === 'create' ? 'Создать' : found?.member ? 'Открыть сервер' : 'Присоединиться'
	);

	const footnote = $derived.by((): Footnote => {
		if (error) return { kind: 'error', text: error };
		if (view === 'create') return { kind: 'rules' };
		if (found) return { kind: 'found', serverId: found.serverId };
		return lookup.checking ? { kind: 'checking' } : { kind: 'hint' };
	});

	const footnoteKey = $derived(
		footnote.kind === 'error'
			? `error:${footnote.text}`
			: footnote.kind === 'found'
				? `found:${footnote.serverId}`
				: footnote.kind
	);

	function setFieldValue(next: string) {
		if (view === 'create') name = next;
		else lookup.input = next;
	}

	async function create() {
		submitted = true;
		if (validateServerName(name) || submitting) return;
		submitting = true;
		serverError = '';
		const result = await createServer(name);
		submitting = false;
		if (!result.ok) {
			serverError = result.message;
			return;
		}
		oncreated(result.server);
	}

	async function join() {
		const result = await lookup.join();
		if (result?.ok) onjoined(result.server);
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void (view === 'create' ? create() : join());
	}

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<Dialog
	label={view === 'create' ? 'Новый сервер' : 'Присоединиться к серверу'}
	locked={busy}
	{onclose}
>
	<SegmentedControl label="Сервер" options={views} bind:value={view} disabled={busy} />

	<form onsubmit={handleSubmit} class="mt-6">
		<div class="flex flex-col items-center">
			<div class="grid h-[72px] w-[72px]">
				{#key view}
					<div class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
						{#if view === 'create'}
							<button
								type="button"
								aria-label="Добавить аватар"
								title="Скоро"
								class="pressable flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-line text-muted duration-200 hover:border-line-strong hover:text-ink"
							>
								<Icon name="camera" size={22} />
							</button>
						{:else}
							<div
								class="grid h-[72px] w-[72px] place-items-center rounded-full transition-colors duration-200 {found
									? 'bg-online/10 text-online'
									: 'bg-white/[0.05] text-muted'} {lookup.checking ? 'animate-pulse' : ''}"
							>
								{#key found !== null}
									<span class="col-start-1 row-start-1 flex" in:settle out:settle={{ duration: 100 }}>
										<Icon name={found ? 'check' : 'link'} size={22} />
									</span>
								{/key}
							</div>
						{/if}
					</div>
				{/key}
			</div>

			<div class="mt-2 grid h-5 grid-cols-1 justify-items-center">
				{#key view}
					<span
						class="col-start-1 row-start-1 text-[11px] leading-5 text-muted"
						in:settle
						out:settle={{ duration: 100 }}
					>
						{view === 'create' ? 'Добавить аватар' : 'По приглашению'}
					</span>
				{/key}
			</div>
		</div>

		<div class="mt-4">
			<PillInput
				label={view === 'create' ? 'Название' : 'Ссылка или код'}
				bind:value={() => (view === 'create' ? name : lookup.input), setFieldValue}
				invalid={error !== ''}
			/>
		</div>

		<div class="mt-3">
			<PillButton type="submit" loading={busy}>
				<span class="grid place-items-center">
					{#key submitLabel}
						<span class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
							{submitLabel}
						</span>
					{/key}
				</span>
			</PillButton>
		</div>

		<div class="mt-3 grid h-8 grid-cols-1 justify-items-center">
			{#key footnoteKey}
				<p
					class="col-start-1 row-start-1 max-w-full text-center text-[11px] leading-4 {footnote.kind ===
					'error'
						? 'text-danger'
						: 'text-muted'}"
					in:settle
					out:settle={{ duration: 100 }}
				>
					{#if footnote.kind === 'error'}
						{footnote.text}
					{:else if footnote.kind === 'rules'}
						Создавая сервер, вы принимаете
						<button
							type="button"
							class="link-underline text-ink-secondary transition-colors duration-200 hover:text-ink"
						>
							правила сообщества
						</button>
					{:else if footnote.kind === 'found' && found}
						<span class="block truncate">
							<span class="font-medium text-ink-secondary">{found.serverName}</span>
							· {found.member ? 'вы уже участник' : memberCountLabel(found.memberCount)}
						</span>
					{:else if footnote.kind === 'checking'}
						Проверяем приглашение…
					{:else}
						Подойдёт ссылка astronida://invite/… или код из 10 символов
					{/if}
				</p>
			{/key}
		</div>
	</form>

	<div class="flex justify-center pt-3">
		<button
			type="button"
			disabled={busy}
			onclick={onclose}
			class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink disabled:opacity-60"
		>
			Отмена
		</button>
	</div>
</Dialog>
