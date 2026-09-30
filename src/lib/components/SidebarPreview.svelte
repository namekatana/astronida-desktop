<script lang="ts">
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import type { PreviewItem } from './sidebar-preview';

	interface Props {
		items: PreviewItem[];
		context: string;
		placeholder: string;
	}

	let { items, context, placeholder }: Props = $props();
</script>

<div
	aria-hidden="true"
	class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-[14px] bg-white/[0.03] px-2 pb-2 [mask-image:linear-gradient(to_bottom,transparent,black_28px)] [corner-shape:squircle]"
>
	{#key context}
		<div
			class="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col justify-end"
			in:settle
			out:settle={{ duration: 100 }}
		>
			{#each items as item (item.key)}
				{#if item.type === 'heading'}
					<div
						class="mt-2 flex h-7 shrink-0 items-center gap-1.5 px-2 text-[12px] font-bold first:mt-0 {item.fresh
							? 'text-ink-secondary'
							: 'text-muted opacity-40'}"
					>
						<Icon name="chevron" size={12} />
						<span class="min-w-0 truncate {item.fresh && !item.label ? 'text-muted' : ''}">
							{item.label || placeholder}
						</span>
					</div>
				{:else if item.type === 'channel'}
					<div
						class="flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13px] {item.fresh
							? 'bg-white/[0.06] text-ink'
							: 'text-ink-secondary opacity-40'}"
					>
						<span class="grid shrink-0 text-muted">
							{#key item.kind}
								<span class="col-start-1 row-start-1" in:settle out:settle={{ duration: 100 }}>
									<Icon name={item.kind} />
								</span>
							{/key}
						</span>
						<span class="min-w-0 truncate {item.fresh && !item.label ? 'text-muted' : ''}">
							{item.label || placeholder}
						</span>
					</div>
				{:else}
					<div class="flex h-9 shrink-0 items-center px-2.5 text-[13px] text-muted">
						{item.label}
					</div>
				{/if}
			{/each}
		</div>
	{/key}
</div>
