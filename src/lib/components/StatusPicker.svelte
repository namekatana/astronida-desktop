<script lang="ts">
	import { on } from 'svelte/events';
	import { fade } from 'svelte/transition';
	import {
		statusDotClass,
		statusHints,
		statusLabels,
		userStatuses,
		type UserStatus
	} from '$lib/presence/status';
	import { pop } from '$lib/ui/pop';
	import { portal } from '$lib/ui/portal';
	import { settle } from '$lib/ui/settle';
	import Icon from './Icon.svelte';

	interface Props {
		status: UserStatus;
		onchoose: (status: UserStatus) => void;
	}

	let { status, onchoose }: Props = $props();

	const menuWidth = 232;
	const menuHeight = 184;
	const gap = 6;
	const edge = 8;

	let open = $state(false);
	let highlighted = $state(0);
	let trigger = $state<HTMLButtonElement | null>(null);
	let list = $state<HTMLDivElement | null>(null);
	let position = $state({ left: 0, top: 0, above: false });

	const selectedIndex = $derived(userStatuses.indexOf(status));

	function place() {
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const fitsBelow = window.innerHeight - rect.bottom >= menuHeight + gap + edge;
		const above = !fitsBelow && rect.top >= menuHeight + gap + edge;
		const centered = rect.left + rect.width / 2 - menuWidth / 2;
		const left = Math.min(Math.max(centered, edge), window.innerWidth - menuWidth - edge);
		position = { left, top: above ? rect.top - gap - menuHeight : rect.bottom + gap, above };
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

	function pick(index: number, fromKeyboard: boolean) {
		onchoose(userStatuses[index]);
		open = false;
		if (fromKeyboard) trigger?.focus();
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
			highlighted = (highlighted + step + userStatuses.length) % userStatuses.length;
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			pick(highlighted, true);
		} else if (event.key === 'Tab') {
			open = false;
		}
	}

	$effect(() => {
		if (!open) return;
		const close = () => (open = false);
		const offKey = on(window, 'keydown', handleKey, { capture: true });
		const offPointer = on(document, 'pointerdown', (event) => {
			const target = event.target as Node;
			if (!trigger?.contains(target) && !list?.contains(target)) close();
		});
		const offResize = on(window, 'resize', close);
		return () => {
			offKey();
			offPointer();
			offResize();
		};
	});
</script>

<button
	bind:this={trigger}
	type="button"
	aria-haspopup="listbox"
	aria-expanded={open}
	aria-label="Статус: {statusLabels[status]}"
	onclick={toggle}
	class="pressable flex h-7 items-center gap-1.5 rounded-full pr-2.5 pl-2.5 text-[12px] font-semibold text-ink-secondary duration-150 hover:bg-white/[0.08] hover:text-ink {open
		? 'bg-white/[0.08] text-ink'
		: 'bg-white/[0.05]'}"
>
	<span
		class="h-2 w-2 shrink-0 rounded-full transition-[background-color] duration-300 ease-soft {statusDotClass[
			status
		]}"
	></span>
	<span class="grid grid-cols-1">
		{#key status}
			<span class="col-start-1 row-start-1 whitespace-nowrap" in:settle out:settle={{ duration: 100 }}>
				{statusLabels[status]}
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
		bind:this={list}
		use:portal
		role="listbox"
		aria-label="Статус"
		in:pop={{ y: position.above ? 6 : -6, duration: 200 }}
		out:fade={{ duration: 100 }}
		class="panel panel-floating fixed z-50 flex flex-col p-2 {position.above
			? 'origin-bottom'
			: 'origin-top'}"
		style="left: {position.left}px; top: {position.top}px; width: {menuWidth}px"
	>
		{#each userStatuses as option, index (option)}
			{@const hint = statusHints[option]}
			<button
				type="button"
				role="option"
				aria-selected={index === selectedIndex}
				onpointerenter={() => (highlighted = index)}
				onclick={(event) => pick(index, event.detail === 0)}
				class="flex w-full items-center gap-2.5 rounded-[10px] px-3 text-left [corner-shape:squircle] transition-colors duration-150 {hint
					? 'h-12'
					: 'h-9'} {index === highlighted ? 'bg-white/[0.06]' : ''}"
			>
				<span class="h-2.5 w-2.5 shrink-0 rounded-full {statusDotClass[option]}"></span>
				<span class="flex min-w-0 flex-1 flex-col">
					<span
						class="truncate text-[13px] {index === highlighted ? 'text-ink' : 'text-ink-secondary'}"
					>
						{statusLabels[option]}
					</span>
					{#if hint}
						<span class="truncate text-[11px] leading-4 text-muted">{hint}</span>
					{/if}
				</span>
				{#if index === selectedIndex}
					<Icon name="check" size={14} class="text-ink" />
				{/if}
			</button>
		{/each}
	</div>
{/if}
