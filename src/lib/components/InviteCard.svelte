<script lang="ts">
	import { untrack } from 'svelte';
	import {
		cachedPreview,
		joinByInvite,
		memberCountLabel,
		previewInvite,
		type PreviewResult
	} from '$lib/servers/invites';
	import type { Server } from '$lib/servers/servers';
	import { initials } from '$lib/ui/initials';

	interface Props {
		code: string;
		onjoined: (server: Server) => void;
	}

	let { code, onjoined }: Props = $props();

	let preview = $state<PreviewResult | null>(untrack(() => cachedPreview(code)));
	let joining = $state(false);
	let joinError = $state('');

	$effect(() => {
		const current = code;
		let active = true;
		preview = cachedPreview(current);
		void previewInvite(current).then((result) => {
			if (active) preview = result;
		});
		return () => {
			active = false;
		};
	});

	async function join() {
		if (joining) return;
		joining = true;
		joinError = '';
		const result = await joinByInvite(code);
		joining = false;
		if (!result.ok) {
			joinError = result.message;
			return;
		}
		preview = cachedPreview(code);
		onjoined(result.server);
	}
</script>

<div
	class="mt-1 mb-1 w-full max-w-[340px] rounded-xl border border-surface-line bg-white/[0.03] px-3.5 pt-3 pb-3.5"
>
	<p class="text-[12px] font-semibold text-muted">Приглашение на сервер</p>

	<div class="mt-2.5 flex h-10 items-center gap-3">
		{#if preview?.ok}
			{@const invite = preview.preview}
			<span
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[13px] font-medium text-ink"
			>
				{initials(invite.serverName)}
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[14px] leading-5 font-semibold text-ink">
					{invite.serverName}
				</span>
				<span class="block text-[12px] text-muted tabular-nums">
					{memberCountLabel(invite.memberCount)}
				</span>
			</span>
			<button
				type="button"
				disabled={joining}
				onclick={join}
				class="pressable flex h-8 shrink-0 items-center rounded-full px-3.5 text-[12px] font-medium duration-150 disabled:opacity-50 {invite.member
					? 'border border-line text-ink hover:border-line-strong'
					: 'bg-ink text-bg hover:bg-ink-hover'}"
			>
				{invite.member ? 'Открыть' : 'Присоединиться'}
			</button>
		{:else if preview}
			<span class="text-[13px] text-muted">
				{preview.reason === 'not_found'
					? 'Приглашение недействительно или истекло'
					: 'Не удалось загрузить приглашение'}
			</span>
		{:else}
			<span class="h-10 w-10 shrink-0 rounded-full bg-surface-raised"></span>
			<span class="text-[13px] text-muted">Загружаем приглашение…</span>
		{/if}
	</div>

	{#if joinError}
		<p class="mt-2 text-[12px] text-danger">{joinError}</p>
	{/if}
</div>
