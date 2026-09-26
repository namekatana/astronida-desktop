<script lang="ts">
	import { fade } from 'svelte/transition';
	import { shownStatus } from '$lib/realtime/shown-status.svelte';

	interface Props {
		title: string;
		class?: string;
	}

	let { title, class: className = '' }: Props = $props();

	const statusLabels = {
		connecting: 'Соединение',
		updating: 'Обновление'
	} as const;
</script>

<h2 class="grid min-w-0 text-[15px] font-semibold text-ink {className}">
	{#key shownStatus.value}
		<span
			class="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5"
			transition:fade={{ duration: 150 }}
		>
			{#if shownStatus.value}
				<span class="truncate">{statusLabels[shownStatus.value]}</span>
				<span class="typing-dots flex shrink-0 items-center gap-0.5 text-muted" aria-hidden="true">
					<span></span><span></span><span></span>
				</span>
			{:else}
				<span class="truncate">{title}</span>
			{/if}
		</span>
	{/key}
</h2>
