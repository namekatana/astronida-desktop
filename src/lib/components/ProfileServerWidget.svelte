<script lang="ts">
	import { fade } from 'svelte/transition';
	import { widgetTileClass } from '$lib/profile/widget-tile';
	import {
		cachedPreview,
		joinByInvite,
		memberCountLabel,
		previewInvite,
		type InvitePreview
	} from '$lib/servers/invites';
	import type { Server } from '$lib/servers/servers';
	import { initials } from '$lib/ui/initials';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import Orbit from './Orbit.svelte';

	interface Props {
		serverId: string;
		inviteCode: string | null;
		compact: boolean;
		knownServers?: Server[];
		sample?: { name: string; memberCount: number } | null;
		locked?: boolean;
		onpick?: (anchor: HTMLElement) => void;
		onopen?: (server: Server) => void;
	}

	let {
		serverId,
		inviteCode,
		compact,
		knownServers = [],
		sample = null,
		locked = false,
		onpick,
		onopen
	}: Props = $props();

	const failureMs = 2000;

	let preview = $state<InvitePreview | null>(null);
	let missing = $state(false);
	let joining = $state(false);
	let failed = $state(false);
	let failureTimer: ReturnType<typeof setTimeout> | undefined;

	const editable = $derived(onpick !== undefined);
	const known = $derived(knownServers.find((server) => server.id === serverId) ?? null);
	const name = $derived(sample?.name ?? preview?.serverName ?? known?.name ?? null);
	const memberCount = $derived(sample?.memberCount ?? preview?.memberCount ?? null);
	const unavailable = $derived(!sample && !editable && missing);
	const actionLabel = $derived(preview?.member ? 'Открыть' : 'Вступить');

	$effect(() => {
		const code = inviteCode;
		if (sample || !code) return;
		const cached = cachedPreview(code);
		if (cached?.ok) preview = cached.preview;
		missing = cached?.ok === false && cached.reason === 'not_found';
		let current = true;
		void previewInvite(code).then((result) => {
			if (!current) return;
			if (result.ok) {
				preview = result.preview;
				missing = false;
			} else if (result.reason === 'not_found') {
				missing = true;
			}
		});
		return () => {
			current = false;
		};
	});

	$effect(() => {
		return () => clearTimeout(failureTimer);
	});

	async function open() {
		if (!inviteCode || joining || sample) return;
		joining = true;
		const result = await joinByInvite(inviteCode);
		joining = false;
		if (result.ok) {
			onopen?.(result.server);
			return;
		}
		failed = true;
		clearTimeout(failureTimer);
		failureTimer = setTimeout(() => (failed = false), failureMs);
	}
</script>

{#snippet emblem()}
	<span
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-surface-raised text-[15px] font-semibold text-ink [corner-shape:squircle]"
	>
		{name ? initials(name) : ''}
	</span>
{/snippet}

{#snippet details()}
	<span class="flex min-w-0 flex-1 flex-col">
		{#if name}
			<span class="truncate text-[15px] leading-5 font-semibold text-ink">{name}</span>
			<span class="truncate text-[12px] leading-4 text-muted">
				{memberCount === null ? 'Ваш сервер' : memberCountLabel(memberCount)}
			</span>
		{:else}
			<span class="h-3.5 w-24 rounded-full bg-white/[0.08]"></span>
			<span class="mt-1.5 h-3 w-16 rounded-full bg-white/[0.05]"></span>
		{/if}
	</span>
{/snippet}

{#snippet action()}
	{#if editable}
		<button
			type="button"
			disabled={locked}
			onclick={(event) => onpick?.(event.currentTarget)}
			class="pressable flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-ink duration-150 hover:bg-white/[0.12] disabled:opacity-40"
		>
			Сменить сервер
			<Icon name="chevron" size={12} class="text-muted" />
		</button>
	{:else}
		<button
			type="button"
			disabled={!inviteCode && !sample}
			aria-busy={joining}
			onclick={open}
			class="pressable grid h-8 shrink-0 place-items-center rounded-full px-4 text-[13px] font-semibold duration-150 {failed
				? 'bg-white/[0.08] text-danger'
				: 'bg-ink text-bg hover:bg-ink-hover'}"
		>
			{#key joining ? 'joining' : failed ? 'failed' : actionLabel}
				<span class="col-start-1 row-start-1 flex items-center" in:settle out:settle={{ duration: 100 }}>
					{#if joining}
						<Orbit size={16} />
					{:else if failed}
						Не удалось
					{:else}
						{actionLabel}
					{/if}
				</span>
			{/key}
		</button>
	{/if}
{/snippet}

<section
	data-widget-card
	class="flex h-full min-w-0 overflow-hidden transition-opacity duration-150 {widgetTileClass} {compact
		? 'items-center gap-3 px-[18px]'
		: 'flex-col px-3.5 pt-3 pb-3.5'} {locked ? 'opacity-60' : ''}"
>
	{#if unavailable}
		<p
			class="flex flex-1 items-center justify-center gap-1.5 text-[13px] text-muted"
			in:fade={{ duration: 150 }}
		>
			<Icon name="users" size={14} class="opacity-60" />
			Сервер недоступен
		</p>
	{:else if compact}
		{@render emblem()}
		{@render details()}
		{@render action()}
	{:else}
		<h3 class="flex h-5 shrink-0 items-center gap-1.5 text-[12px] font-semibold text-muted">
			<Icon name="users" size={13} />
			Мой сервер
		</h3>
		<div class="mt-2.5 flex min-w-0 items-center gap-3">
			{@render emblem()}
			{@render details()}
		</div>
		<div class="mt-auto flex flex-col pt-3 [&>button]:w-full">
			{@render action()}
		</div>
	{/if}
</section>
