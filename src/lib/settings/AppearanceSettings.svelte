<script lang="ts">
	import { theme, themeOptions, type ThemeId } from '$lib/ui/theme.svelte';
	import CheckCircle from '$lib/ui/CheckCircle.svelte';
	import ThemePreview from './ThemePreview.svelte';

	let buttons = $state<Partial<Record<ThemeId, HTMLButtonElement>>>({});

	function handleKeydown(event: KeyboardEvent, index: number) {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (step === 0) return;
		event.preventDefault();
		const next = themeOptions[(index + step + themeOptions.length) % themeOptions.length];
		theme.choose(next.id);
		buttons[next.id]?.focus();
	}
</script>

<section aria-labelledby="appearance-theme">
	<h4 id="appearance-theme" class="px-1 pb-2 text-[13px] font-semibold text-muted">Тема</h4>
	<div role="radiogroup" aria-labelledby="appearance-theme" class="grid grid-cols-2 gap-3">
		{#each themeOptions as option, index (option.id)}
			{@const selected = theme.current === option.id}
			<button
				bind:this={buttons[option.id]}
				type="button"
				role="radio"
				aria-checked={selected}
				tabindex={selected ? 0 : -1}
				onclick={() => theme.choose(option.id)}
				onkeydown={(event) => handleKeydown(event, index)}
				class="group flex flex-col gap-3 rounded-plate bg-fill p-2 pb-3 text-left transition-colors duration-150 outline-none [corner-shape:squircle] hover:bg-fill-raised focus-visible:bg-fill-raised"
			>
				<span
					class="block overflow-hidden rounded-row outline-2 outline-offset-2 transition-[outline-color] duration-150 [corner-shape:squircle] {selected
						? 'outline-ink'
						: 'outline-transparent group-hover:outline-tint/20'}"
				>
					<ThemePreview theme={option.id} />
				</span>
				<span class="flex items-center gap-3 px-1.5">
					<CheckCircle checked={selected} />
					<span class="min-w-0 flex-1">
						<span class="block truncate text-[14px] leading-5 text-ink">{option.label}</span>
						<span class="mt-0.5 block truncate text-[12px] leading-4 text-muted">
							{option.description}
						</span>
					</span>
				</span>
			</button>
		{/each}
	</div>
	<p class="px-1 pt-2 text-[12px] leading-4 text-muted">Тема хранится только на этом устройстве</p>
</section>
