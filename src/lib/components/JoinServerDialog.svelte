<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		joinByInvite,
		memberCountLabel,
		parseInviteCode,
		previewInvite,
		type PreviewResult
	} from '$lib/servers/invites';
	import type { Server } from '$lib/servers/servers';
	import { initials } from '$lib/ui/initials';
	import Dialog from './Dialog.svelte';
	import PillButton from './PillButton.svelte';
	import PillInput from './PillInput.svelte';

	interface Props {
		initialValue?: string;
		onjoined: (server: Server) => void;
		onclose: () => void;
	}

	let { initialValue = '', onjoined, onclose }: Props = $props();

	const previewDebounceMs = 250;

	let input = $state(untrack(() => initialValue));
	let preview = $state<PreviewResult | null>(null);
	let submitted = $state(false);
	let joining = $state(false);
	let joinError = $state('');

	const code = $derived(parseInviteCode(input));

	const error = $derived.by(() => {
		if (joinError) return joinError;
		if (preview && !preview.ok) {
			return preview.reason === 'not_found'
				? 'Приглашение недействительно или истекло'
				: 'Не удалось проверить приглашение';
		}
		if (submitted && !code) return 'Вставьте ссылку-приглашение или код';
		return '';
	});

	$effect(() => {
		const current = code;
		preview = null;
		joinError = '';
		if (!current) return;
		let active = true;
		const timer = setTimeout(() => {
			void previewInvite(current).then((result) => {
				if (active) preview = result;
			});
		}, previewDebounceMs);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (!code || joining) return;
		joining = true;
		joinError = '';
		const result = await joinByInvite(code);
		joining = false;
		if (!result.ok) {
			joinError = result.message;
			return;
		}
		onjoined(result.server);
	}
</script>

<Dialog label="Присоединиться к серверу" locked={joining} {onclose}>
	<form onsubmit={handleSubmit}>
		<h2 class="text-center text-[15px] font-semibold text-ink">Присоединиться к серверу</h2>
		<p class="mt-1 text-center text-[13px] text-ink-secondary">
			Вставьте ссылку-приглашение или код
		</p>

		<div class="mt-6">
			<PillInput label="Ссылка или код" bind:value={input} invalid={error !== ''} />
		</div>

		<div class="mt-4 grid h-14">
			{#if preview?.ok}
				{@const invite = preview.preview}
				<div
					class="col-start-1 row-start-1 flex items-center gap-3 px-2"
					in:fade={{ duration: 160 }}
					out:fade={{ duration: 100 }}
				>
					<span
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[13px] font-medium text-ink"
					>
						{initials(invite.serverName)}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-[14px] font-semibold text-ink">{invite.serverName}</span>
						<span class="block text-[12px] text-muted tabular-nums">
							{invite.member ? 'Вы уже участник · ' : ''}{memberCountLabel(invite.memberCount)}
						</span>
					</span>
				</div>
			{/if}
		</div>

		<p
			class="flex h-9 items-center justify-center text-center text-[13px] leading-5 text-danger transition-opacity duration-200 {error
				? 'opacity-100'
				: 'opacity-0'}"
		>
			{error}
		</p>

		<PillButton type="submit" loading={joining}>
			{preview?.ok && preview.preview.member ? 'Открыть сервер' : 'Присоединиться'}
		</PillButton>

		<div class="flex justify-center pt-4">
			<button
				type="button"
				disabled={joining}
				onclick={onclose}
				class="link-underline text-[13px] text-muted transition-colors duration-200 hover:text-ink disabled:opacity-60"
			>
				Отмена
			</button>
		</div>
	</form>
</Dialog>
