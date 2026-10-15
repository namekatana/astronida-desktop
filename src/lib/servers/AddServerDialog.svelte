<script lang="ts">
	import { untrack } from 'svelte';
	import { renderAvatar, type AvatarImages } from '$lib/media/avatar-image';
	import { createImageEditor } from '$lib/profile/image-editor.svelte';
	import { createInviteLookup } from '$lib/invites/invite-lookup.svelte';
	import { inviteLinkOf, memberCountLabel } from '$lib/invites/invites';
	import { uploadServerIcon } from './server-icon';
	import {
		applyServerTemplate,
		serverTemplates,
		type ServerTemplate
	} from './server-templates';
	import {
		createServer,
		serverNameMaxLength,
		validateServerName,
		type Server
	} from './servers';
	import { settle } from '$lib/ui/settle';
	import type { AddServerView } from './add-server';
	import DashedFrame from '$lib/ui/DashedFrame.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import ImageCropper from '$lib/media/ImageCropper.svelte';
	import LengthCounter from '$lib/ui/LengthCounter.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import ServerIcon from './ServerIcon.svelte';
	import SheetHeader from '$lib/ui/SheetHeader.svelte';

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
	const exampleCode = 'hTKzmak3Qp';
	const inviteExamples = [inviteLinkOf(exampleCode), exampleCode];
	const iconFrame = { width: 280, height: 280, radius: 140, rotatable: true };

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
		join: 'Вступая на сервер, вы принимаете правила сообщества'
	};

	const lookup = createInviteLookup(untrack(() => initialValue));

	let createdServerId = '';
	const iconEditor = createImageEditor<AvatarImages>({
		render: renderAvatar,
		previewOf: (images) => images.large,
		upload: (images) => uploadServerIcon(createdServerId, images),
		remove: async () => ({ ok: true, id: null })
	});

	let view = $state<AddServerView>(untrack(() => initialView));
	let template = $state<ServerTemplate>(serverTemplates[0]);
	let templateButtons = $state<HTMLButtonElement[]>([]);
	let iconButton = $state<HTMLButtonElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let cropper = $state<ReturnType<typeof ImageCropper>>();
	let cropExit = $state<'apply' | 'cancel'>('apply');
	let name = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let done = $state(false);
	let serverError = $state('');

	const cropping = $derived(iconEditor.step === 'crop' && iconEditor.source !== null);
	const iconPreview = $derived(iconEditor.draft.kind === 'new' ? iconEditor.draft.url : null);
	const busy = $derived(submitting || lookup.joining || done);
	const createError = $derived(
		(submitted ? validateServerName(name) : '') || serverError || (iconEditor.error ?? '')
	);
	const error = $derived(view === 'create' ? createError : lookup.error);
	const found = $derived(lookup.found);
	const fieldValue = $derived(view === 'create' ? name : lookup.input);

	const title = $derived(
		cropping ? 'Фото сервера' : view === 'create' ? 'Новый сервер' : 'Присоединиться'
	);
	const actionLabel = $derived.by(() => {
		if (cropping) return 'Готово';
		if (view === 'create') return 'Создать';
		return found?.member ? 'Открыть' : 'Вступить';
	});
	const actionDisabled = $derived(
		cropping ? false : view === 'create' ? name.trim() === '' : found === null
	);
	const subtitle = $derived.by(() => {
		if (cropping) return null;
		if (error) return error;
		return view === 'join' && lookup.checking ? 'Проверяем приглашение…' : null;
	});

	const identityKey = $derived(
		view === 'create'
			? `create:${iconPreview ?? ''}`
			: found
				? `found:${found.serverId}:${found.member}`
				: 'join'
	);
	const sectionKey = $derived(
		view === 'create' ? 'create' : found ? `found:${found.serverId}:${found.member}` : 'join'
	);
	const sectionTitle = $derived(
		view === 'create' ? 'Шаблон' : found ? 'Сервер' : 'Приглашение выглядит так'
	);

	$effect(() => () => iconEditor.reset());

	function setFieldValue(next: string) {
		if (view === 'create') name = next;
		else lookup.input = next;
	}

	function handleTemplateKeydown(event: KeyboardEvent, index: number) {
		const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
		if (step === 0) return;
		event.preventDefault();
		const nextIndex = (index + step + serverTemplates.length) % serverTemplates.length;
		template = serverTemplates[nextIndex];
		templateButtons[nextIndex]?.focus();
	}

	function takeFile(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		cropExit = 'apply';
		void iconEditor.pick(file);
	}

	function cancelCrop() {
		cropExit = 'cancel';
		iconEditor.cancelCrop();
	}

	function applyCrop() {
		if (!cropper) return;
		cropExit = 'apply';
		void iconEditor.applyCrop(cropper.cropArea());
	}

	function iconRect(): DOMRect | null {
		return iconButton?.getBoundingClientRect() ?? null;
	}

	function handleClose() {
		if (cropping) cancelCrop();
		else onclose();
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
		createdServerId = result.server.id;
		const [, icon] = await Promise.all([
			applyServerTemplate(result.server.id, template),
			iconEditor.save()
		]);
		submitting = false;
		const iconId = icon?.ok ? icon.id : null;
		finish(() => oncreated({ ...result.server, iconId }));
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
		if (cropping) return;
		void (view === 'create' ? create() : join());
	}
</script>

<Dialog label={title} wide flush pinTop locked={busy || iconEditor.busy} onclose={handleClose}>
	<SheetHeader
		{title}
		{subtitle}
		subtitleDanger={error !== ''}
		cancelLabel="Отмена"
		cancelDisabled={busy || iconEditor.busy}
		oncancel={handleClose}
		{actionLabel}
		actionForm={cropping ? undefined : formId}
		onaction={cropping ? applyCrop : undefined}
		{actionDisabled}
		actionBusy={submitting || lookup.joining || iconEditor.busy}
		actionDone={done}
	/>

	<form
		id={formId}
		class="relative flex h-[396px] flex-col px-4 pt-1 pb-4"
		onsubmit={handleSubmit}
	>
		<SegmentedControl label="Сервер" options={views} bind:value={view} disabled={busy} />

		<div class="mt-4 flex items-center gap-3">
			<div class="grid h-12 w-12 shrink-0">
				{#key identityKey}
					<div class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
						{#if view === 'create'}
							<button
								bind:this={iconButton}
								type="button"
								aria-label={iconPreview ? 'Сменить фото сервера' : 'Добавить фото сервера'}
								disabled={busy}
								onclick={() => fileInput?.click()}
								class="group pressable relative flex h-12 w-12 items-center justify-center rounded-full text-muted will-change-transform duration-200 hover:text-ink"
							>
								{#if iconPreview}
									<img
										src={iconPreview}
										alt=""
										class="absolute inset-0 h-full w-full rounded-full object-cover"
									/>
									<span
										class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
									>
										<Icon name="camera" size={16} />
									</span>
								{:else}
									<DashedFrame
										radius={24}
										class="text-line transition-colors duration-200 group-hover:text-line-strong"
									/>
									<Icon name="camera" size={18} />
								{/if}
							</button>
						{:else if found}
							<span
								class="relative flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-[15px] font-semibold text-ink"
							>
								<ServerIcon serverId={found.serverId} iconId={found.iconId} name={found.serverName} />
							</span>
						{:else}
							<span
								class="flex h-12 w-12 items-center justify-center rounded-full bg-fill text-muted {lookup.checking
									? 'animate-pulse'
									: ''}"
							>
								<Icon name="link" size={18} />
							</span>
						{/if}
					</div>
				{/key}
			</div>

			<label
				class="relative grid h-12 min-w-0 flex-1 rounded-plate bg-fill transition-colors duration-150 [corner-shape:squircle] focus-within:bg-fill-raised"
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
		</div>

		<div class="mt-5 grid grid-cols-1">
			{#key sectionKey}
				<section
					class="col-start-1 row-start-1 flex flex-col"
					in:settle
					out:settle={{ duration: 100 }}
				>
					<h3 class="px-1 pb-1.5 text-[12px] leading-4 font-semibold text-muted">
						{sectionTitle}
					</h3>
					<div class="overflow-hidden rounded-plate bg-fill [corner-shape:squircle]">
						{#if view === 'create'}
							<div role="radiogroup" aria-label="Шаблон">
								{#each serverTemplates as option, index (option.id)}
									{@const selected = template.id === option.id}
									{#if index > 0}
										<div class="ml-[52px] h-px bg-surface-line"></div>
									{/if}
									<button
										bind:this={templateButtons[index]}
										type="button"
										role="radio"
										aria-checked={selected}
										tabindex={selected ? 0 : -1}
										disabled={busy}
										onclick={() => (template = option)}
										onkeydown={(event) => handleTemplateKeydown(event, index)}
										class="flex h-11 w-full items-center gap-3 px-3 text-left transition-colors duration-150 outline-none enabled:hover:bg-fill-faint focus-visible:bg-fill-faint"
									>
										<span
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-tile bg-fill-raised text-ink-secondary [corner-shape:squircle]"
										>
											<Icon name={option.icon} size={15} />
										</span>
										<span class="min-w-0 flex-1 truncate text-[14px] text-ink">{option.label}</span>
										<Icon
											name="check"
											size={16}
											class="text-ink transition-opacity duration-150 {selected
												? 'opacity-100'
												: 'opacity-0'}"
										/>
									</button>
								{/each}
							</div>
						{:else if found}
							<div class="flex h-11 items-center px-4">
								<span class="min-w-0 flex-1 truncate text-[14px] text-ink">
									{found.serverName}
									<span class="text-[12px] text-muted">
										· {found.member ? 'вы уже участник' : memberCountLabel(found.memberCount)}
									</span>
								</span>
							</div>
						{:else}
							{#each inviteExamples as example, index (example)}
								{#if index > 0}
									<div class="ml-4 h-px bg-surface-line"></div>
								{/if}
								<p
									class="flex h-10 items-center truncate px-4 text-[13px] text-ink-secondary select-text"
								>
									{example}
								</p>
							{/each}
						{/if}
					</div>
					<p class="mt-2 px-4 text-[12px] leading-4 text-muted">{notes[view]}</p>
				</section>
			{/key}
		</div>

		{#if cropping && iconEditor.source}
			<ImageCropper
				bind:this={cropper}
				source={iconEditor.source}
				frame={iconFrame}
				exit={cropExit}
				targetRect={iconRect}
			/>
		{/if}
	</form>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={(event) => takeFile(event.currentTarget)}
	/>
</Dialog>
