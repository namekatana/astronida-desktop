<script lang="ts" generics="T">
	import { on } from 'svelte/events';
	import { fade } from 'svelte/transition';
	import { pop } from '$lib/ui/pop';
	import Icon from './Icon.svelte';

	interface Props {
		label: string;
		options: { value: T; label: string }[];
		value: T;
		disabled?: boolean;
	}

	let { label, options, value = $bindable(), disabled = false }: Props = $props();

	const menuWidth = 208;
	const rowHeight = 36;
	const menuPadding = 8;
	const gap = 6;
	const edge = 8;

	let open = $state(false);
	let highlighted = $state(0);
	let root = $state<HTMLDivElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);
	let position = $state({ left: 0, top: 0, above: false });

	const selectedIndex = $derived(options.findIndex((option) => Object.is(option.value, value)));
	const selectedLabel = $derived(options[selectedIndex]?.label ?? '');

	function place() {
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const height = options.length * rowHeight + menuPadding * 2;
		const fitsBelow = window.innerHeight - rect.bottom >= height + gap + edge;
		const above = !fitsBelow && rect.top >= height + gap + edge;
		const left = Math.min(
			Math.max(rect.right - menuWidth, edge),
			window.innerWidth - menuWidth - edge
		);
		position = { left, top: above ? rect.top - gap - height : rect.bottom + gap, above };
	}

	function toggle() {
		if (open) {
			open = false;
			return;
		}
		place();
		highlighted = Math.max(selectedIndex, 0);
		open = true;
	}

	function pick(index: number) {
		value = options[index].value;
		open = false;
		trigger?.focus();
	}

	function handleKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			open = false;
			trigger?.focus();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			highlighted = (highlighted + step + options.length) % options.length;
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			pick(highlighted);
		} else if (event.key === 'Tab') {
			open = false;
		}
	}

	$effect(() => {
		if (!open) return;
		const close = () => (open = false);
		const offKey = on(window, 'keydown', handleKey, { capture: true });
		const offPointer = on(document, 'pointerdown', (event) => {
			if (!root?.contains(event.target as Node)) close();
		});
		const offResize = on(window, 'resize', close);
		const offScroll = on(window, 'scroll', close, { capture: true });
		return () => {
			offKey();
			offPointer();
			offResize();
			offScroll();
		};
	});

	function settle(_node: Element, { duration = 150 }: { duration?: number } = {}) {
		return {
			duration,
			css: (t: number) => `opacity: ${t}; filter: blur(${(1 - t) * 2}px)`
		};
	}
</script>

<div bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		aria-haspopup="listbox"
		aria-expanded={open}
		{disabled}
		onclick={toggle}
		class="flex h-12 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-white/[0.03] disabled:pointer-events-none disabled:opacity-60 {open
			? 'bg-white/[0.03]'
			: ''}"
	>
		<span class="min-w-0 flex-1 truncate text-[13px] text-ink">{label}</span>
		<span class="grid shrink-0 justify-items-end">
			{#key selectedLabel}
				<span
					class="col-start-1 row-start-1 text-[13px] text-ink-secondary tabular-nums"
					in:settle
					out:settle={{ duration: 100 }}
				>
					{selectedLabel}
				</span>
			{/key}
		</span>
		<Icon
			name="chevron"
			size={12}
			class="text-muted transition-transform duration-200 ease-soft {open ? 'rotate-180' : ''}"
		/>
	</button>

	{#if open}
		<div
			role="listbox"
			aria-label={label}
			in:pop={{ y: position.above ? 6 : -6, duration: 200 }}
			out:fade={{ duration: 100 }}
			class="panel panel-floating fixed z-50 p-2 {position.above
				? 'origin-bottom-right'
				: 'origin-top-right'}"
			style="left: {position.left}px; top: {position.top}px; width: {menuWidth}px"
		>
			{#each options as option, index (option.label)}
				<button
					type="button"
					role="option"
					aria-selected={index === selectedIndex}
					onpointerenter={() => (highlighted = index)}
					onclick={() => pick(index)}
					class="flex h-9 w-full items-center gap-2.5 rounded-[10px] px-3 text-left [corner-shape:squircle] text-[13px] transition-colors duration-150 {index ===
					highlighted
						? 'bg-white/[0.06] text-ink'
						: 'text-ink-secondary'}"
				>
					<span class="flex-1 tabular-nums">{option.label}</span>
					{#if index === selectedIndex}
						<Icon name="check" size={14} class="text-ink" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
