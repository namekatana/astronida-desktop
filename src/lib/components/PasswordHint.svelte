<script lang="ts">
	import { passwordRules } from '$lib/auth/password-rules';

	interface Props {
		password: string;
	}

	let { password }: Props = $props();
</script>

<span class="group relative block">
	<span
		role="img"
		aria-label="Требования к паролю"
		class="flex h-6 w-6 cursor-default items-center justify-center rounded-full border border-line text-[11px] font-medium text-muted transition-colors duration-200 group-hover:border-line-strong group-hover:text-ink"
	>
		i
	</span>

	<div
		class="pointer-events-none absolute top-1/2 left-full z-10 -translate-y-1/2 pl-7 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
	>
		<div
			role="tooltip"
			class="w-72 rounded-2xl border border-line bg-bg p-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]"
		>
			<p class="text-[11px] tracking-[0.08em] text-muted uppercase">Пароль должен содержать</p>
			<ul class="mt-3 flex flex-col gap-2">
				{#each passwordRules as rule (rule.id)}
					{@const passed = rule.test(password)}
					<li
						class="flex items-center gap-2.5 text-[13px] whitespace-nowrap transition-colors duration-200 {passed
							? 'text-ink'
							: 'text-muted'}"
					>
						<span
							class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 {passed
								? 'border-ink bg-ink text-bg'
								: 'border-line'}"
						>
							{#if passed}
								<svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
									<path
										d="M1.5 4.2l1.8 1.8L6.5 2.5"
										stroke="currentColor"
										stroke-width="1.4"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							{/if}
						</span>
						{rule.label}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</span>
