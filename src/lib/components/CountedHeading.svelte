<script lang="ts">
	import { settle } from '$lib/ui/settle';

	interface Props {
		id: string;
		label: string;
		count: number | null;
		error: string | null;
	}

	let { id, label, count, error }: Props = $props();
</script>

<div class="grid grid-cols-1 px-1 pb-2">
	{#key error}
		<h4
			{id}
			in:settle
			out:settle={{ duration: 100 }}
			class="col-start-1 row-start-1 text-[13px] font-semibold {error
				? 'text-danger'
				: 'text-muted'}"
		>
			{#if error}
				{error}
			{:else}
				{label}<span
					class="tabular-nums transition-opacity duration-150 ease-soft {count === null
						? 'opacity-0'
						: 'opacity-100'}">{` — ${count ?? 0}`}</span
				>
			{/if}
		</h4>
	{/key}
</div>
