<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		value: string;
		placeholder?: string;
		transform?: (raw: string) => string;
		prefix?: string;
	}

	let { value = $bindable(), placeholder = 'Поиск', transform, prefix }: Props = $props();

	let input = $state<HTMLInputElement>();

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		const next = transform ? transform(event.currentTarget.value) : event.currentTarget.value;
		event.currentTarget.value = next;
		value = next;
	}

	function clear() {
		value = '';
		input?.focus();
	}
</script>

<label
	class="flex h-9 items-center gap-2 rounded-full bg-white/[0.06] pr-1.5 pl-3.5 text-muted transition-colors duration-150 focus-within:bg-white/[0.08]"
>
	{#if prefix}
		<span class="w-[15px] shrink-0 text-center text-[14px] {value ? 'text-ink' : ''}">{prefix}</span>
	{:else}
		<Icon name="search" size={15} class="shrink-0" />
	{/if}
	<input
		bind:this={input}
		{value}
		{placeholder}
		type="text"
		spellcheck="false"
		autocomplete="off"
		aria-label={placeholder}
		oninput={handleInput}
		class="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
	/>
	<button
		type="button"
		aria-label="Очистить"
		tabindex={value ? 0 : -1}
		onclick={clear}
		class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-[opacity,color] duration-150 hover:text-ink {value
			? 'opacity-100'
			: 'pointer-events-none opacity-0'}"
	>
		<Icon name="close" size={13} />
	</button>
</label>
