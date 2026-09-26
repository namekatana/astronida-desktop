<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dev } from '$app/environment';
	import '../app.css';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import { updates } from '$lib/updates/updates.svelte';

	let { children }: { children: Snippet } = $props();

	let windowActive = $state(true);

	function updateActivity() {
		windowActive = document.hasFocus() && document.visibilityState === 'visible';
	}

	$effect(() => {
		updateActivity();
		updates.schedule();
	});

	function isReloadShortcut(event: KeyboardEvent): boolean {
		if (event.key === 'F5') return true;
		return (event.ctrlKey || event.metaKey) && event.code === 'KeyR';
	}

	function blockReload(event: KeyboardEvent) {
		if (!dev && isReloadShortcut(event)) event.preventDefault();
	}

	function isEditable(target: EventTarget | null): boolean {
		return (
			target instanceof Element &&
			target.closest('input, textarea, [contenteditable="true"]') !== null
		);
	}

	function hasSelectedText(): boolean {
		return (window.getSelection()?.toString() ?? '') !== '';
	}

	function blockContextMenu(event: MouseEvent) {
		if (dev && event.shiftKey) return;
		if (isEditable(event.target) || hasSelectedText()) return;
		event.preventDefault();
	}
</script>

<svelte:window
	onfocus={updateActivity}
	onblur={updateActivity}
	onkeydown={blockReload}
	oncontextmenu={blockContextMenu}
/>
<svelte:document onvisibilitychange={updateActivity} />

<div class="smooth-text flex h-screen flex-col bg-bg" data-inactive={windowActive ? undefined : ''}>
	<TitleBar />

	<main class="relative flex-1 overflow-hidden">
		<div class="relative h-full overflow-y-auto">
			{@render children()}
		</div>
	</main>
</div>
