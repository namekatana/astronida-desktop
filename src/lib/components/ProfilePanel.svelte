<script lang="ts">
	import type { TransitionConfig } from 'svelte/transition';
	import type { ProfileCard } from '$lib/profile/profile';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';
	import ProfileContent from './ProfileContent.svelte';
	import SmoothScroll from './SmoothScroll.svelte';

	interface Props {
		card: ProfileCard;
		animated: boolean;
		onback?: () => void;
	}

	let { card, animated, onback }: Props = $props();

	function appear(node: Element): TransitionConfig {
		return animated ? settle(node) : { duration: 0 };
	}
</script>

<aside
	aria-label="Профиль @{card.target.username}"
	class="panel relative flex min-h-0 flex-1 flex-col overflow-hidden"
>
	<SmoothScroll scrollbar class="min-h-0 flex-1" contentClass="grid p-1.5 pb-4">
		{#key card.target.id}
			<div class="col-start-1 row-start-1 flex min-w-0 flex-col items-center" in:appear>
				<ProfileContent {card} cometDelay={null} animated={false} />
			</div>
		{/key}
	</SmoothScroll>

	{#if onback}
		<button
			type="button"
			aria-label="Назад"
			onclick={onback}
			class="pressable absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full text-muted duration-150 hover:bg-white/[0.08] hover:text-ink"
		>
			<Icon name="chevron" size={16} class="rotate-90" />
		</button>
	{/if}
</aside>
