<script lang="ts">
	import { qualityBars, qualityColorClass } from '$lib/voice/quality';
	import type { VoiceQuality } from '$lib/voice/transport';

	interface Props {
		quality: VoiceQuality;
		title?: string;
		class?: string;
	}

	let { quality, title, class: className = '' }: Props = $props();

	const bars = $derived(qualityBars(quality));
</script>

<span
	{title}
	class="inline-flex shrink-0 transition-colors duration-200 {qualityColorClass(quality)} {quality ===
	'lost'
		? 'animate-pulse'
		: ''} {className}"
>
	<svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true" class="block">
		{#each [1, 2, 3] as bar (bar)}
			<rect
				x={(bar - 1) * 4}
				y={10 - bar * 3}
				width="3"
				height={bar * 3}
				rx="0.75"
				fill="currentColor"
				opacity={bar <= bars ? 1 : 0.25}
			/>
		{/each}
	</svg>
</span>
