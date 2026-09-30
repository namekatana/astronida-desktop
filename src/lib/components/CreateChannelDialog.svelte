<script lang="ts">
	import {
		createChannel,
		nameMaxLength,
		validateName,
		type Category,
		type Channel,
		type ChannelKind
	} from '$lib/channels/channels';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';
	import LengthCounter from './LengthCounter.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SelectMenu from './SelectMenu.svelte';
	import SheetHeader from './SheetHeader.svelte';
	import SidebarPreview from './SidebarPreview.svelte';
	import type { PreviewItem } from './sidebar-preview';

	interface Props {
		serverId: string;
		serverName: string;
		initialKind: ChannelKind;
		categories: Category[];
		channels: Channel[];
		oncreated: (channel: Channel) => void;
		onclose: () => void;
	}

	let { serverId, serverName, initialKind, categories, channels, oncreated, onclose }: Props =
		$props();

	const previewSiblings = 3;

	const formId = 'create-channel-form';
	const closeDelayMs = 450;

	// svelte-ignore state_referenced_locally
	let kind = $state<ChannelKind>(initialKind);
	let name = $state('');
	let categoryId = $state<string | null>(null);
	let submitted = $state(false);
	let submitting = $state(false);
	let done = $state(false);
	let serverError = $state('');

	const validationError = $derived(submitted ? validateName(name) : '');
	const error = $derived(validationError || serverError);
	const busy = $derived(submitting || done);

	const kinds: { value: ChannelKind; label: string }[] = [
		{ value: 'text', label: 'Текстовый' },
		{ value: 'voice', label: 'Голосовой' }
	];

	const kindNotes: Record<ChannelKind, string> = {
		text: 'Переписка для всех участников сервера',
		voice: 'Разговор голосом — войти можно в один клик'
	};

	const categoryOptions = $derived([
		{ value: null, label: 'Без категории' },
		...categories.map((category): { value: string | null; label: string } => ({
			value: category.id,
			label: category.name
		}))
	]);

	const previewItems = $derived.by((): PreviewItem[] => {
		const category = categories.find((known) => known.id === categoryId);
		const siblings = channels
			.filter((channel) => channel.categoryId === categoryId)
			.sort((a, b) => a.position - b.position)
			.slice(-previewSiblings);
		return [
			...(category
				? [{ key: `heading:${category.id}`, type: 'heading' as const, label: category.name }]
				: []),
			...siblings.map((channel) => ({
				key: channel.id,
				type: 'channel' as const,
				kind: channel.kind,
				label: channel.name
			})),
			{ key: 'fresh', type: 'channel', kind, label: name.trim(), fresh: true }
		];
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateName(name) || busy) return;
		submitting = true;
		serverError = '';
		const result = await createChannel({ serverId, categoryId, name, kind });
		submitting = false;
		if (!result.ok) {
			serverError = result.message;
			return;
		}
		done = true;
		setTimeout(() => oncreated(result.value), closeDelayMs);
	}

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<Dialog label="Новый канал" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Новый канал"
		subtitle={error || `«${serverName}»`}
		subtitleDanger={error !== ''}
		cancelLabel="Отмена"
		cancelDisabled={busy}
		oncancel={onclose}
		actionLabel="Создать"
		actionForm={formId}
		actionDisabled={name.trim() === ''}
		actionBusy={submitting}
		actionDone={done}
	/>

	<form id={formId} class="flex h-[396px] flex-col px-4 pt-1 pb-4" onsubmit={handleSubmit}>
		<SegmentedControl label="Тип канала" options={kinds} bind:value={kind} disabled={busy} />

		<div
			class="mt-3 overflow-hidden rounded-[14px] bg-white/[0.05] transition-colors duration-150 [corner-shape:squircle] has-[input:focus]:bg-white/[0.07]"
		>
			<label class="flex h-12 items-center gap-3 pl-4">
				<span class="grid shrink-0 text-muted">
					{#key kind}
						<span class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
							<Icon name={kind} size={16} />
						</span>
					{/key}
				</span>
				<input
					bind:value={name}
					type="text"
					maxlength={nameMaxLength}
					placeholder="Название канала"
					aria-label="Название канала"
					aria-invalid={error !== ''}
					spellcheck="false"
					autocomplete="off"
					disabled={busy}
					class="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
				/>
				<span class="pr-4">
					<LengthCounter value={name} max={nameMaxLength} />
				</span>
			</label>
			<div class="mx-4 h-px bg-surface-line"></div>
			<SelectMenu
				label="Категория"
				options={categoryOptions}
				bind:value={categoryId}
				disabled={busy}
			/>
		</div>

		<div class="mt-2 grid h-4 grid-cols-1 px-4">
			{#key kind}
				<p
					class="col-start-1 row-start-1 truncate text-[12px] leading-4 text-muted"
					in:settle
					out:settle={{ duration: 100 }}
				>
					{kindNotes[kind]}
				</p>
			{/key}
		</div>

		<h3 class="mt-5 px-1 pb-1.5 text-[12px] font-semibold text-muted">Предпросмотр</h3>
		<SidebarPreview
			items={previewItems}
			context={categoryId ?? 'none'}
			placeholder="новый канал"
		/>
	</form>
</Dialog>
