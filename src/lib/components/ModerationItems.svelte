<script lang="ts">
	import MenuItem from './MenuItem.svelte';

	interface Props {
		onkick: () => void;
		onban: () => void;
	}

	let { onkick, onban }: Props = $props();
</script>

<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
<div class="flex flex-col gap-0.5">
	<MenuItem icon="member-remove" label="Удалить с сервера" onclick={onkick} destructive />
	<MenuItem icon="member-ban" label="Заблокировать" onclick={onban} destructive />
</div>
