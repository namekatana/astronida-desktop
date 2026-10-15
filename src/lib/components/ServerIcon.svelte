<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		cachedServerIcon,
		loadServerIcon,
		type ServerIconVariant
	} from '$lib/servers/server-icon-images';
	import { initials } from '$lib/ui/initials';

	interface Props {
		serverId: string;
		iconId: string | null | undefined;
		name: string;
		variant?: ServerIconVariant;
	}

	let { serverId, iconId, name, variant = 'small' }: Props = $props();

	function cachedFor(id: string | null | undefined, size: ServerIconVariant): string | null {
		return id ? cachedServerIcon(id, size) : null;
	}

	let url = $state(untrack(() => cachedFor(iconId, variant)));
	let failed = $state(false);

	$effect(() => {
		const server = serverId;
		const id = iconId;
		const size = variant;
		failed = false;
		url = cachedFor(id, size);
		if (!id || url) return;
		let active = true;
		void loadServerIcon(server, id, size).then((loaded) => {
			if (!active) return;
			url = loaded;
			failed = loaded === null;
		});
		return () => {
			active = false;
		};
	});
</script>

{#if url}
	<img
		src={url}
		alt=""
		draggable="false"
		class="absolute inset-0 h-full w-full rounded-full object-cover"
		in:fade={{ duration: 150 }}
	/>
{:else if !iconId || failed}
	{initials(name)}
{/if}
