<script lang="ts">
	import MenuItem from './MenuItem.svelte';

	interface Props {
		serverName: string;
		onkick: () => void;
		onban: () => void;
	}

	let { serverName, onkick, onban }: Props = $props();
</script>

<div class="mx-1.5 my-1.5 h-px bg-surface-line"></div>
<p class="truncate px-2.5 pt-0.5 pb-1 text-[11px] leading-4 font-semibold text-muted">
	На сервере «{serverName}»
</p>
<div class="flex flex-col gap-0.5">
	<MenuItem icon="member-remove" label="Удалить с сервера" onclick={onkick} destructive />
	<MenuItem icon="member-ban" label="Заблокировать на сервере" onclick={onban} destructive />
</div>
