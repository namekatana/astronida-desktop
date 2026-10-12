<script lang="ts">
	import type { ThemeId } from '$lib/ui/theme.svelte';

	interface Props {
		theme: ThemeId;
	}

	let { theme }: Props = $props();

	const messages = [
		{ name: 'w-8', lines: ['w-[70%]'] },
		{ name: 'w-6', lines: ['w-[55%]', 'w-[38%]'] },
		{ name: 'w-9', lines: ['w-[62%]'] }
	];
	const channels = ['w-[70%]', 'w-[52%]', 'w-[64%]'];
	const members = [true, true, false];
</script>

<div
	aria-hidden="true"
	data-theme={theme}
	class="flex aspect-[16/10] w-full flex-col gap-1 bg-bg p-1.5 text-ink"
>
	<div class="flex h-3.5 shrink-0 items-center gap-1 rounded-full bg-surface px-1">
		<span class="h-1.5 w-2.5 rounded-full bg-tint/40"></span>
		<span class="flex h-2.5 w-9 items-center gap-1 rounded-full bg-tab-pill px-0.5">
			<span class="h-1.5 w-1.5 rounded-full bg-surface-raised"></span>
			<span class="h-1 w-4 rounded-full bg-ink/40"></span>
		</span>
		<span class="h-1 w-5 rounded-full bg-tint/20"></span>
		<span class="ml-auto h-2 w-2 rounded-full bg-surface-raised"></span>
	</div>
	<div class="flex min-h-0 flex-1 gap-1">
		<div class="flex w-[26%] flex-col gap-1.5 rounded-[6px] bg-surface p-1.5">
			<span class="h-1.5 w-[60%] rounded-full bg-ink/70"></span>
			{#each channels as width, index (index)}
				<span
					class="flex h-2.5 items-center rounded-[3px] px-1 {index === 0 ? 'bg-tint/[0.08]' : ''}"
				>
					<span class="h-1 rounded-full {index === 0 ? 'bg-ink/60' : 'bg-tint/25'} {width}"></span>
				</span>
			{/each}
		</div>
		<div class="flex min-w-0 flex-1 flex-col justify-end gap-1.5 rounded-[6px] bg-surface-deep p-1.5">
			{#each messages as message, index (index)}
				<div class="flex gap-1">
					<span class="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-raised"></span>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="h-1 rounded-full bg-ink/60 {message.name}"></span>
						{#each message.lines as width, line (line)}
							<span class="h-1 rounded-full bg-tint/25 {width}"></span>
						{/each}
					</div>
				</div>
			{/each}
			<span class="mt-0.5 flex h-3 shrink-0 items-center rounded-full bg-tint/[0.06] px-1">
				<span class="h-1 w-[30%] rounded-full bg-tint/20"></span>
				<span class="ml-auto h-1.5 w-1.5 rounded-full bg-ink/70"></span>
			</span>
		</div>
		<div class="flex w-[20%] flex-col gap-1.5 rounded-[6px] bg-surface p-1.5">
			<span class="h-1.5 w-[70%] rounded-full bg-ink/70"></span>
			{#each members as online, index (index)}
				<span class="flex items-center gap-1 {online ? '' : 'opacity-40'}">
					<span class="relative h-2.5 w-2.5 shrink-0 rounded-full bg-surface-raised">
						{#if online}
							<span
								class="absolute -right-px -bottom-px h-1 w-1 rounded-full bg-online ring-1 ring-surface"
							></span>
						{/if}
					</span>
					<span class="h-1 flex-1 rounded-full bg-tint/25"></span>
				</span>
			{/each}
		</div>
	</div>
</div>
