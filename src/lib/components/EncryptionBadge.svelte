<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { voice } from '$lib/voice/voice.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const available = $derived(voice.status === 'connected' && voice.encrypted);
	const groups = $derived(voice.keyFingerprint?.split(' ') ?? []);

	$effect(() => {
		if (!available) open = false;
	});
</script>

{#if available}
	<div
		role="group"
		aria-label="Шифрование"
		class="flex shrink-0"
		onpointerenter={() => (open = true)}
		onpointerleave={() => (open = false)}
		onfocusin={() => (open = true)}
		onfocusout={() => (open = false)}
	>
		<button
			type="button"
			aria-label="Код безопасности"
			aria-describedby={open ? 'voice-security-code' : undefined}
			class="-m-1 flex h-5 w-5 items-center justify-center rounded-md transition-colors duration-150 {open
				? 'bg-white/[0.08] text-ink'
				: 'text-muted'}"
		>
			<Icon name="lock" size={12} />
		</button>

		{#if open}
			<div
				class="absolute inset-x-0 bottom-full z-50 pb-2"
				in:fly={{ y: 6, duration: 220, easing: (t) => 1 - Math.pow(1 - t, 3) }}
				out:fade={{ duration: 120 }}
			>
				<div
					id="voice-security-code"
					role="tooltip"
					class="panel origin-bottom px-4 pt-3.5 pb-4"
				>
					<div class="flex items-baseline justify-between gap-2">
						<div class="text-[11px] font-medium tracking-[0.1em] text-muted uppercase">
							Сквозное шифрование
						</div>
						<div class="shrink-0 text-[11px] text-muted tabular-nums">ключ №{voice.keyVersion}</div>
					</div>
					<div class="mt-3 grid grid-cols-3 gap-x-2 gap-y-1.5">
						{#each groups as group, index (index)}
							<div
								class="rounded-md bg-surface-raised py-1.5 text-center font-mono text-[13px] tracking-[0.08em] text-ink tabular-nums"
							>
								{group}
							</div>
						{/each}
					</div>
					<p class="mt-3 text-[12px] leading-relaxed text-muted">
						Назовите код друг другу. Если он совпадает у всех в канале, разговор зашифрован одним
						ключом и медиасервер его не видит. Код меняется, когда кто-то выходит из канала.
					</p>
				</div>
			</div>
		{/if}
	</div>
{/if}
