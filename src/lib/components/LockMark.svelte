<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		size?: number;
		class?: string;
	}

	let { size = 14, class: className = '' }: Props = $props();
</script>

<span
	role="img"
	aria-label="Пока недоступно"
	title="Скоро"
	class="flex shrink-0 text-muted {className}"
>
	<Icon name="lock" {size} />
</span>
