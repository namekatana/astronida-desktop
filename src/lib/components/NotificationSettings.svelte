<script lang="ts">
	import { notificationSections, type NotificationSettingId } from '$lib/settings/notifications';
	import CheckCircle from './CheckCircle.svelte';

	interface Props {
		settings: Record<NotificationSettingId, boolean>;
	}

	let { settings = $bindable() }: Props = $props();

	function toggle(id: NotificationSettingId) {
		settings = { ...settings, [id]: !settings[id] };
	}
</script>

{#each notificationSections as section, sectionIndex (section.id)}
	<section aria-labelledby="notifications-{section.id}" class={sectionIndex > 0 ? 'mt-6' : ''}>
		<h4 id="notifications-{section.id}" class="px-1 pb-2 text-[13px] font-semibold text-muted">
			{section.title}
		</h4>
		<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
			{#each section.items as item, index (item.id)}
				{@const checked = settings[item.id]}
				{#if index > 0}
					<div class="ml-4 h-px bg-white/[0.06]"></div>
				{/if}
				<button
					type="button"
					role="checkbox"
					aria-checked={checked}
					onclick={() => toggle(item.id)}
					class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.03] {item.description
						? 'min-h-[60px]'
						: 'min-h-[52px]'}"
				>
					<span class="min-w-0 flex-1">
						<span
							class="block truncate text-[14px] leading-5 transition-colors duration-150 {checked
								? 'text-ink'
								: 'text-ink-secondary'}"
						>
							{item.label}
						</span>
						{#if item.description}
							<span class="mt-0.5 block truncate text-[12px] leading-4 text-muted">
								{item.description}
							</span>
						{/if}
					</span>
					<CheckCircle {checked} />
				</button>
			{/each}
		</div>
		{#if section.note}
			<p class="px-1 pt-2 text-[12px] leading-4 text-muted">{section.note}</p>
		{/if}
	</section>
{/each}
