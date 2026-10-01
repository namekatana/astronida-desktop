<script lang="ts">
	import { untrack } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { TransitionConfig } from 'svelte/transition';
	import { statusDotClass, statusTextClass, type UserStatus } from '$lib/presence/status';
	import { initials } from '$lib/ui/initials';

	interface Props {
		name: string;
		online: boolean;
		status: UserStatus;
		cometDelay: number | null;
	}

	let { name, online, status, cometDelay }: Props = $props();

	const stageSize = 120;
	const center = stageSize / 2;
	const dotOffset = 32;
	const orbitRadius = dotOffset * Math.SQRT2;
	const landingAngle = 45;
	const flightAngle = 320;
	const flightMs = 820;
	const landingMs = 580;
	const mergeMs = 420;
	const headScale = 0.6;
	const fillMs = 460;
	const pulseMs = 420;
	const pulseScale = 1.18;
	const softEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';

	const trails = [
		{ length: 46, width: 1.5, opacity: 0.22 },
		{ length: 20, width: 2.5, opacity: 0.6 },
		{ length: 0.1, width: 7, opacity: 1 }
	];

	const cometPlanned =
		untrack(() => online && cometDelay !== null) && !prefersReducedMotion.current;

	let comet = $state<SVGSVGElement | null>(null);
	let dot = $state<HTMLSpanElement | null>(null);
	let shownStatus = $state(untrack(() => status));
	let baseStatus = $state(untrack(() => status));
	let firstFlight = true;

	let latestStatus = untrack(() => status);

	export function showStatusNow() {
		if (!dot) return;
		dot.classList.remove(...Object.values(statusDotClass));
		dot.classList.add(statusDotClass[latestStatus]);
		for (const fill of dot.children) {
			if (fill instanceof HTMLElement) fill.style.visibility = 'hidden';
		}
	}

	function recolor(next: UserStatus) {
		if (next === shownStatus) return;
		baseStatus = shownStatus;
		shownStatus = next;
		if (prefersReducedMotion.current) return;
		dot?.animate([{ scale: '1' }, { scale: `${pulseScale}` }, { scale: '1' }], {
			duration: pulseMs,
			easing: softEasing
		});
	}

	function fillIn(_node: Element): TransitionConfig {
		if (prefersReducedMotion.current) return { duration: 150, css: (t) => `opacity: ${t}` };
		return {
			duration: fillMs,
			easing: quintOut,
			css: (t) => `transform: scale(${t}); opacity: ${Math.min(1, 0.5 + t)}`
		};
	}

	$effect(() => {
		const next = status;
		latestStatus = next;
		if (next === untrack(() => shownStatus)) return;
		if (!cometPlanned) {
			untrack(() => recolor(next));
			return;
		}
		const landing = setTimeout(() => recolor(next), landingMs);
		return () => clearTimeout(landing);
	});

	$effect(() => {
		const svg = comet;
		const landingDot = dot;
		if (!svg || !landingDot) return;
		const initial = firstFlight;
		firstFlight = false;
		const delay = initial ? (untrack(() => cometDelay) ?? 0) : 0;
		const animations = [...svg.querySelectorAll('circle')].map((circle, index) => {
			const finalOffset = -(landingAngle - trails[index].length);
			return circle.animate(
				[{ strokeDashoffset: finalOffset + flightAngle }, { strokeDashoffset: finalOffset }],
				{ duration: flightMs, delay, easing: softEasing, fill: 'both' }
			);
		});
		const appear = svg.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 120,
			delay,
			fill: 'backwards'
		});
		const disappear = svg.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: mergeMs,
			delay: delay + landingMs,
			easing: 'ease-out',
			fill: 'forwards'
		});
		const arrive = initial
			? landingDot.animate(
					[
						{ opacity: 0, transform: `scale(${headScale})` },
						{ opacity: 1, transform: 'scale(1)' }
					],
					{ duration: mergeMs, delay: delay + landingMs, easing: softEasing, fill: 'backwards' }
				)
			: null;
		return () => {
			for (const animation of [...animations, appear, disappear]) animation.cancel();
			arrive?.cancel();
		};
	});
</script>

<div
	data-avatar-stage
	class="relative -my-4 flex h-[120px] w-[120px] shrink-0 items-center justify-center"
>
	<span data-avatar class="relative block h-[88px] w-[88px]">
		<span
			data-avatar-face
			class="flex h-full w-full items-center justify-center rounded-full bg-[#38383c] text-[30px] font-medium text-ink ring-[6px] ring-surface"
		>
			<span data-avatar-initials class="block">{initials(name)}</span>
		</span>
		<span
			bind:this={dot}
			data-avatar-dot
			class="absolute right-0.5 bottom-0.5 h-5 w-5 overflow-hidden rounded-full border-4 border-surface transition-[opacity,scale] duration-200 ease-soft {statusDotClass[
				baseStatus
			]} {online ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}"
		>
			{#key shownStatus}
				<span class="absolute inset-0 rounded-full {statusDotClass[shownStatus]}" in:fillIn></span>
			{/key}
		</span>
	</span>

	{#if cometPlanned}
		{#key status}
			<svg
				bind:this={comet}
				aria-hidden="true"
				viewBox="0 0 {stageSize} {stageSize}"
				class="pointer-events-none absolute inset-0 h-full w-full overflow-visible {statusTextClass[
					status
				]}"
			>
				{#each trails as trail, index (index)}
					<circle
						cx={center}
						cy={center}
						r={orbitRadius}
						fill="none"
						stroke="currentColor"
						stroke-width={trail.width}
						stroke-linecap="round"
						pathLength="360"
						stroke-dasharray="{trail.length} {360 - trail.length}"
						opacity={trail.opacity}
					/>
				{/each}
			</svg>
		{/key}
	{/if}
</div>
