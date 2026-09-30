<script lang="ts">
	import {
		createCategory,
		nameMaxLength,
		validateName,
		type Category,
		type Channel
	} from '$lib/channels/channels';
	import Dialog from './Dialog.svelte';
	import LengthCounter from './LengthCounter.svelte';
	import SheetHeader from './SheetHeader.svelte';
	import SidebarPreview from './SidebarPreview.svelte';
	import type { PreviewItem } from './sidebar-preview';

	interface Props {
		serverId: string;
		serverName: string;
		categories: Category[];
		channels: Channel[];
		oncreated: (category: Category) => void;
		onclose: () => void;
	}

	let { serverId, serverName, categories, channels, oncreated, onclose }: Props = $props();

	const formId = 'create-category-form';
	const closeDelayMs = 450;
	const previewCategories = 2;

	let name = $state('');
	let submitted = $state(false);
	let submitting = $state(false);
	let done = $state(false);
	let serverError = $state('');

	const validationError = $derived(submitted ? validateName(name) : '');
	const error = $derived(validationError || serverError);

	const previewItems = $derived.by((): PreviewItem[] => {
		const earlier = [...categories]
			.sort((a, b) => a.position - b.position)
			.slice(-previewCategories);
		const items: PreviewItem[] = [];
		for (const category of earlier) {
			items.push({ key: `heading:${category.id}`, type: 'heading', label: category.name });
			const channel = channels
				.filter((known) => known.categoryId === category.id)
				.sort((a, b) => a.position - b.position)
				.at(-1);
			if (channel) {
				items.push({ key: channel.id, type: 'channel', kind: channel.kind, label: channel.name });
			}
		}
		items.push({ key: 'fresh', type: 'heading', label: name.trim(), fresh: true });
		items.push({ key: 'note', type: 'note', label: 'Пока без каналов' });
		return items;
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (validateName(name) || submitting || done) return;
		submitting = true;
		serverError = '';
		const result = await createCategory(serverId, name);
		submitting = false;
		if (!result.ok) {
			serverError = result.message;
			return;
		}
		done = true;
		setTimeout(() => oncreated(result.value), closeDelayMs);
	}
</script>

<Dialog label="Новая категория" wide flush pinTop locked={submitting || done} {onclose}>
	<SheetHeader
		title="Новая категория"
		subtitle={error || `«${serverName}»`}
		subtitleDanger={error !== ''}
		cancelLabel="Отмена"
		cancelDisabled={submitting || done}
		oncancel={onclose}
		actionLabel="Создать"
		actionForm={formId}
		actionDisabled={name.trim() === ''}
		actionBusy={submitting}
		actionDone={done}
	/>

	<form id={formId} class="flex h-[396px] flex-col px-4 pt-1 pb-4" onsubmit={handleSubmit}>
		<div
			class="flex items-center gap-2 rounded-[14px] bg-white/[0.05] pr-4 transition-colors duration-150 [corner-shape:squircle] focus-within:bg-white/[0.07]"
		>
			<input
				bind:value={name}
				type="text"
				maxlength={nameMaxLength}
				placeholder="Название категории"
				aria-label="Название категории"
				aria-invalid={error !== ''}
				spellcheck="false"
				autocomplete="off"
				disabled={submitting || done}
				class="h-12 min-w-0 flex-1 bg-transparent pl-4 text-[14px] text-ink outline-none placeholder:text-muted"
			/>
			<LengthCounter value={name} max={nameMaxLength} />
		</div>
		<p class="mt-2 px-4 text-[12px] leading-4 text-muted">
			Категории группируют каналы в списке сервера
		</p>

		<h3 class="mt-5 px-1 pb-1.5 text-[12px] font-semibold text-muted">Предпросмотр</h3>
		<SidebarPreview items={previewItems} context="categories" placeholder="Новая категория" />
	</form>
</Dialog>
