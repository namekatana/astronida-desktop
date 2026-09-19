<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { windowTitle } from '$lib/ui/title.svelte';

	const appWindow = getCurrentWindow();
</script>

<div
	data-tauri-drag-region
	class="relative flex h-9 shrink-0 items-center justify-end gap-1 border-b border-surface-line px-2 select-none"
>
	{#if windowTitle.value}
		<span
			class="pointer-events-none absolute inset-x-0 text-center text-[12px] text-muted"
			data-tauri-drag-region
		>
			{windowTitle.value}
		</span>
	{/if}

	<button
		type="button"
		aria-label="Свернуть"
		class="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-white/[0.07] hover:text-ink"
		onclick={() => appWindow.minimize()}
	>
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			stroke-width="1.25"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<path d="M3 8.5h6" />
		</svg>
	</button>

	<button
		type="button"
		aria-label="Развернуть"
		class="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-white/[0.07] hover:text-ink"
		onclick={() => appWindow.toggleMaximize()}
	>
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			stroke-width="1.25"
			aria-hidden="true"
		>
			<rect x="2.5" y="2.5" width="7" height="7" rx="2" />
		</svg>
	</button>

	<button
		type="button"
		aria-label="Закрыть"
		class="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-danger/90 hover:text-white"
		onclick={() => appWindow.close()}
	>
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			stroke-width="1.25"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<path d="M3.4 3.4l5.2 5.2M8.6 3.4l-5.2 5.2" />
		</svg>
	</button>
</div>
