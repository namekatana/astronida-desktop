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
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import NightSky from './NightSky.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		code: string;
		onjoined: (server: Server) => void;
	}

	let { code, onjoined }: Props = $props();

	let preview = $state<PreviewResult | null>(untrack(() => cachedPreview(code)));
	let attempt = $state(0);
	let joining = $state(false);
	let joinFailed = $state(false);
	let joinError = $state('');

	const view = $derived(preview?.ok ? 'ready' : preview ? preview.reason : 'loading');
	const ready = $derived(preview?.ok ? preview.preview : null);
	const action = $derived(
		ready
			? ready.member
				? 'open'
				: 'join'
			: view === 'not_found'
				? 'unavailable'
				: view === 'failed'
					? 'retry'
					: 'loading'
	);

	const actionLabels: Record<string, string> = {
		join: 'Присоединиться',
		open: 'Открыть',
		unavailable: 'Недоступно',
		retry: 'Повторить'
	};

	$effect(() => {
		const current = code;
		void attempt;
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
		joinFailed = false;
		const result = await joinByInvite(code);
		joining = false;
		if (!result.ok) {
			if (result.missing) {
				preview = { ok: false, reason: 'not_found' };
				return;
			}
			joinError = result.message;
			joinFailed = true;
			return;
		}
		preview = cachedPreview(code);
		onjoined(result.server);
	}

	function runAction() {
		if (action === 'retry') attempt += 1;
		else if (action === 'join' || action === 'open') void join();
	}
</script>

<div
	class="mt-1.5 mb-1 w-[300px] max-w-full rounded-[16px] border border-tint/10 bg-surface p-1.5 [corner-shape:squircle]"
>
	<NightSky
		class="aspect-[4/1] w-full rounded-[10px] transition-opacity duration-200 ease-soft [corner-shape:squircle] {view ===
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
				{#if ready}
					<span
						class="grid size-12 place-items-center rounded-full bg-surface-raised text-[15px] font-semibold text-ink ring-4 ring-surface"
					>
						{initials(ready.serverName)}
					</span>
					<p class="mt-2 h-5 w-full truncate text-[15px] leading-5 font-semibold text-ink">
						{ready.serverName}
					</p>
					<p class="h-4 w-full truncate text-[12px] leading-4 text-muted tabular-nums">
						Приглашение на сервер · {memberCountLabel(ready.memberCount)}
					</p>
				{:else if view === 'loading'}
					<span class="skeleton size-12 rounded-full ring-4 ring-surface"></span>
					<span class="mt-2 flex h-5 items-center">
						<span class="skeleton h-2.5 w-32 rounded-full"></span>
					</span>
					<span class="flex h-4 items-center">
						<span class="skeleton h-2 w-44 rounded-full"></span>
					</span>
				{:else}
					{@const missing = view === 'not_found'}
					<span
						class="grid size-12 place-items-center rounded-full bg-surface-raised text-muted ring-4 ring-surface"
					>
						<Icon name={missing ? 'link-off' : 'info'} size={18} />
					</span>
					<p class="mt-2 h-5 w-full truncate text-[15px] leading-5 font-semibold text-ink-secondary">
						{missing ? 'Приглашение недействительно' : 'Не удалось загрузить'}
					</p>
					<p class="h-4 w-full truncate text-[12px] leading-4 text-muted">
						{missing ? 'Срок истёк или ссылку отозвали' : 'Проверьте соединение'}
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
				disabled={joining || action === 'unavailable'}
				onclick={runAction}
				class="grid h-9 w-full place-items-center rounded-full text-[13px] font-semibold transition-colors duration-150 {action ===
				'join'
					? 'pressable bg-ink text-bg hover:bg-ink-hover'
					: action === 'unavailable'
						? 'cursor-default bg-tint/[0.04] text-muted'
						: 'pressable bg-tint/[0.08] text-ink hover:bg-tint/[0.12]'}"
			>
				{#key action}
					<span
						in:settle
						out:settle={{ duration: 100 }}
						class="col-start-1 row-start-1 transition-opacity duration-150 {joining
							? 'opacity-0'
							: 'opacity-100'}"
					>
						{actionLabels[action]}
					</span>
				{/key}
				<Orbit
					size={16}
					class="col-start-1 row-start-1 transition-opacity duration-150 {joining
						? 'opacity-100'
						: 'opacity-0'}"
				/>
			</button>
		{/if}
	</div>

	<div class="collapsible {joinFailed && view === 'ready' ? 'is-open' : ''}">
		<div>
			<p class="px-1.5 pb-1.5 text-center text-[12px] text-danger">{joinError}</p>
		</div>
	</div>
</div>
