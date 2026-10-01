<script lang="ts">
	const groups = [
		{ opacity: 0.25, name: 22, lines: [64, 38] },
		{ opacity: 0.45, name: 30, lines: [48] },
		{ opacity: 0.7, name: 18, lines: [72, 56, 30] },
		{ opacity: 1, name: 26, lines: [42] }
	];
</script>

<div aria-hidden="true" class="flex flex-col gap-4 px-3 pb-1">
	{#each groups as group, index (index)}
		<div class="flex gap-3" style="opacity: {group.opacity}">
			<span class="skeleton mt-0.5 h-8 w-8 shrink-0 rounded-full"></span>
			<div class="flex min-w-0 flex-1 flex-col gap-2 pt-1.5">
				<span class="skeleton h-2.5 rounded-full" style="width: {group.name}%"></span>
				{#each group.lines as line, lineIndex (lineIndex)}
					<span class="skeleton h-2.5 rounded-full" style="width: {line}%"></span>
				{/each}
			</div>
		</div>
	{/each}
</div>
