<script lang="ts">
	import { tick } from 'svelte';
	import { on } from 'svelte/events';
	import {
		statusDotClass,
		statusHints,
		statusLabels,
		userStatuses,
		type UserStatus
	} from '$lib/presence/status';
	import { settle } from '$lib/ui/settle';

	interface Props {
		status: UserStatus;
		onchoose: (status: UserStatus) => void;
	}

	let { status, onchoose }: Props = $props();

	const optionWidth = 26;
	const labelDelay = 70;
	const returnDelay = 300;
	const jitterRadius = 4;

	let open = $state(false);
	let highlighted = $state(0);
	let shownLabel = $state(0);
	let root = $state<HTMLDivElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);
	let group = $state<HTMLDivElement | null>(null);
	let options = $state<HTMLButtonElement[]>([]);
	let collapsedWidth = $state(0);
	let expandedWidth = $state(0);
	let measured = $state(false);

	let openedAt: { x: number; y: number } | null = null;
	let labelTimer: ReturnType<typeof setTimeout> | undefined;
	let returnTimer: ReturnType<typeof setTimeout> | undefined;

	const selectedIndex = $derived(Math.max(userStatuses.indexOf(status), 0));

	function describe(option: UserStatus): string {
		const hint = statusHints[option];
		return hint ? `${statusLabels[option]}. ${hint}` : statusLabels[option];
	}

	function clearTimers() {
		clearTimeout(labelTimer);
		clearTimeout(returnTimer);
	}

	function highlight(index: number, immediate: boolean) {
		highlighted = index;
		clearTimeout(labelTimer);
		if (immediate) shownLabel = index;
		else labelTimer = setTimeout(() => (shownLabel = highlighted), labelDelay);
	}

	async function expand(event: MouseEvent) {
		openedAt = event.detail === 0 ? null : { x: event.clientX, y: event.clientY };
		highlight(selectedIndex, true);
		open = true;
		await tick();
		options[highlighted]?.focus();
	}

	async function collapse(returnFocus: boolean) {
		clearTimers();
		open = false;
		if (!returnFocus) return;
		await tick();
		trigger?.focus();
	}

	function pick(index: number, fromKeyboard: boolean) {
		const chosen = userStatuses[index];
		if (chosen !== status) onchoose(chosen);
		collapse(fromKeyboard);
	}

	function isJitter(event: PointerEvent): boolean {
		if (!openedAt) return false;
		const distance = Math.hypot(event.clientX - openedAt.x, event.clientY - openedAt.y);
		if (distance < jitterRadius) return true;
		openedAt = null;
		return false;
	}

	function followPointer(event: PointerEvent) {
		if (!group || isJitter(event)) return;
		const offset = event.clientX - group.getBoundingClientRect().left;
		const index = Math.min(Math.max(Math.floor(offset / optionWidth), 0), userStatuses.length - 1);
		if (index !== highlighted) highlight(index, false);
	}

	function holdHighlight() {
		clearTimeout(returnTimer);
	}

	function releaseHighlight() {
		clearTimeout(returnTimer);
		returnTimer = setTimeout(() => highlight(selectedIndex, true), returnDelay);
	}

	function move(step: number) {
		const next = (highlighted + step + userStatuses.length) % userStatuses.length;
		highlight(next, true);
		options[next]?.focus();
	}

	function handleKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			collapse(true);
		} else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			move(event.key === 'ArrowRight' ? 1 : -1);
		} else if (event.key === 'Tab') {
			collapse(false);
		}
	}

	$effect(() => {
		if (measured || collapsedWidth === 0) return;
		const frame = requestAnimationFrame(() => (measured = true));
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!root) return;
		const offEnter = on(root, 'pointerenter', holdHighlight);
		const offLeave = on(root, 'pointerleave', releaseHighlight);
		return () => {
			offEnter();
			offLeave();
		};
	});

	$effect(() => {
		if (!open) return;
		const offKey = on(window, 'keydown', handleKey, { capture: true });
		const offPointer = on(document, 'pointerdown', (event) => {
			if (!root?.contains(event.target as Node)) collapse(false);
		});
		const offResize = on(window, 'resize', () => collapse(false));
		return () => {
			offKey();
			offPointer();
			offResize();
			clearTimers();
		};
	});
</script>

<div
	bind:this={root}
	class="relative h-7 overflow-hidden rounded-full {measured
		? 'transition-[width,background-color,scale] duration-[260ms] ease-soft motion-reduce:transition-[background-color]'
		: ''} {open ? 'bg-white/[0.08]' : 'bg-white/[0.05] hover:bg-white/[0.08] active:scale-[0.97]'}"
	style:width="{open ? expandedWidth : collapsedWidth}px"
>
	<button
		bind:this={trigger}
		bind:offsetWidth={collapsedWidth}
		type="button"
		inert={open}
		aria-expanded={open}
		aria-label="Статус: {statusLabels[status]}"
		onclick={expand}
		class="absolute top-0 left-1/2 flex h-7 w-max -translate-x-1/2 items-center gap-1.5 px-2.5 text-[12px] font-semibold text-ink-secondary transition-[opacity,filter,color] duration-200 ease-soft hover:text-ink {open
			? 'opacity-0 blur-[2px]'
			: ''}"
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
	</button>

	<div
		bind:offsetWidth={expandedWidth}
		inert={!open}
		class="absolute top-0 left-1/2 flex h-7 w-max -translate-x-1/2 items-center transition-[opacity,filter] duration-200 ease-soft {open
			? ''
			: 'opacity-0 blur-[2px]'}"
	>
		<div
			bind:this={group}
			role="radiogroup"
			aria-label="Статус"
			tabindex="-1"
			onpointermove={followPointer}
			class="relative flex h-7 items-center"
		>
			<span
				aria-hidden="true"
				class="absolute top-0.5 left-px h-6 w-6 rounded-full bg-white/[0.12] transition-[translate] duration-[180ms] ease-soft motion-reduce:transition-none"
				style:translate="{highlighted * optionWidth}px 0"
			></span>
			{#each userStatuses as option, index (option)}
				<button
					bind:this={options[index]}
					type="button"
					role="radio"
					aria-checked={index === selectedIndex}
					aria-label={describe(option)}
					title={describe(option)}
					tabindex={index === highlighted ? 0 : -1}
					onfocus={() => highlight(index, true)}
					onclick={(event) => pick(index, event.detail === 0)}
					class="relative flex h-7 w-[26px] items-center justify-center outline-none"
				>
					<span
						class="h-2.5 w-2.5 rounded-full transition-[scale] duration-200 ease-soft motion-reduce:transition-none {statusDotClass[
							option
						]} {index === highlighted ? 'scale-125' : ''}"
					></span>
				</button>
			{/each}
		</div>
		<button
			type="button"
			tabindex="-1"
			aria-hidden="true"
			onclick={() => pick(highlighted, false)}
			class="grid h-7 grid-cols-1 items-center pr-3 pl-2 text-[12px] font-semibold text-ink"
		>
			{#each userStatuses as option, index (option)}
				<span
					class="col-start-1 row-start-1 text-left whitespace-nowrap transition-[opacity,filter] duration-150 ease-soft {index ===
					shownLabel
						? ''
						: 'opacity-0 blur-[2px]'}"
				>
					{statusLabels[option]}
				</span>
			{/each}
		</button>
	</div>
</div>
