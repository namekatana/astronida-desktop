<script lang="ts">
	import type { Snippet } from 'svelte';
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
</script>

<svelte:window onfocus={updateActivity} onblur={updateActivity} />
<svelte:document onvisibilitychange={updateActivity} />

<div class="smooth-text flex h-screen flex-col bg-bg" data-inactive={windowActive ? undefined : ''}>
	<TitleBar />

	<main class="relative flex-1 overflow-hidden">
		<div class="relative h-full overflow-y-auto">
			{@render children()}
		</div>
	</main>
</div>
