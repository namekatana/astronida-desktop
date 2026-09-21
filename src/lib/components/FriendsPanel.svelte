<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import { panelLimits } from '$lib/ui/panel-widths.svelte';
	import Icon from './Icon.svelte';
	import MemberItem from './MemberItem.svelte';
	import ResizeHandle from './ResizeHandle.svelte';

	interface Props {
		friends: Member[];
		requests: Member[];
		width: number;
	}

	let { friends, requests, width = $bindable() }: Props = $props();

	let pendingCollapsed = $state(false);

	const online = $derived(friends.filter((f) => f.online));
	const offline = $derived(friends.filter((f) => !f.online));
	const total = $derived(friends.length);
</script>

<aside class="panel relative flex shrink-0 flex-col" style="width: {width}px">
	<div class="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
		<h2 class="min-w-0 truncate text-[15px] font-semibold text-ink">Друзья</h2>
		<span class="text-[12px] text-muted">{total}</span>
	</div>
	<div class="mx-4 h-px bg-surface-line"></div>

	<div class="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
		<button
			type="button"
			title="Скоро"
			class="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-line text-[13px] text-muted transition-colors duration-200 hover:border-line-strong hover:text-ink"
		>
			<Icon name="plus" size={14} />
			Добавить друга
		</button>

		{#snippet heading(label: string, count: number)}
			<div class="flex h-7 items-center px-2 text-[11px] font-medium tracking-[0.1em] text-muted uppercase">
				{label} — {count}
			</div>
		{/snippet}

		{#if requests.length > 0}
			<div class="mb-2">
				<button
					type="button"
					aria-expanded={!pendingCollapsed}
					onclick={() => (pendingCollapsed = !pendingCollapsed)}
					class="flex h-7 w-full items-center gap-1.5 px-2 text-[11px] font-medium tracking-[0.1em] text-muted uppercase transition-colors duration-150 hover:text-ink"
				>
					<Icon
						name="chevron"
						size={12}
						class="transition-transform duration-300 ease-soft {pendingCollapsed ? '-rotate-90' : ''}"
					/>
					<span>Запросы — {requests.length}</span>
				</button>

				<div class="collapsible {pendingCollapsed ? '' : 'is-open'}" inert={pendingCollapsed}>
					<div>
						<div class="flex flex-col gap-0.5 pt-0.5">
							{#each requests as friend (friend.id)}
								<div class="flex items-center">
									<div class="min-w-0 flex-1">
										<MemberItem member={friend} />
									</div>
									<div class="flex shrink-0 items-center gap-1 pr-1">
										<button
											type="button"
											aria-label="Принять"
											title="Скоро"
											class="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-online"
										>
											<Icon name="check" size={14} />
										</button>
										<button
											type="button"
											aria-label="Отклонить"
											title="Скоро"
											class="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-danger"
										>
											<Icon name="close" size={14} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#snippet group(label: string, list: Member[])}
			{#if list.length > 0}
				<div class="mb-2">
					{@render heading(label, list.length)}
					<div class="flex flex-col gap-0.5 pt-0.5">
						{#each list as friend (friend.id)}
							<MemberItem member={friend} />
						{/each}
					</div>
				</div>
			{/if}
		{/snippet}

		{@render group('В сети', online)}
		{@render group('Не в сети', offline)}
	</div>

	<ResizeHandle side="right" bind:width min={panelLimits.min} max={panelLimits.max} />
</aside>
