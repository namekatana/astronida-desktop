<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { statusDotClass, statusTextClass, type UserStatus } from '$lib/presence/status';
	import { createAvatarSource } from '$lib/profile/avatar-source.svelte';
	import type { AvatarPreview } from '$lib/profile/profile';
	import { initials } from '$lib/ui/initials';
	import Icon from './Icon.svelte';

	interface Props {
		userId: string;
		avatarId: string | null;
		name: string;
		online: boolean;
		status: UserStatus;
		cometDelay: number | null;
		preview?: AvatarPreview;
		onpick?: (anchor: HTMLElement) => void;
	}

	let {
		userId,
		avatarId,
		name,
		online,
		status,
		cometDelay,
		preview = { kind: 'current' },
		onpick
	}: Props = $props();

	const picture = createAvatarSource(() => ({ userId, avatarId, variant: 'large' }));
	const shownUrl = $derived(
		preview.kind === 'draft' ? preview.url : preview.kind === 'none' ? null : picture.url
	);
	const showInitials = $derived(
		preview.kind === 'none' || (preview.kind === 'current' && (avatarId === null || picture.failed))
	);

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
	const recolorMs = 420;
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
	let firstFlight = true;

	let latestStatus = untrack(() => status);

	export function showStatusNow() {
		if (!dot) return;
		dot.style.transition = 'none';
		dot.classList.remove(...Object.values(statusDotClass));
		dot.classList.add(statusDotClass[latestStatus]);
	}

	function recolor(next: UserStatus) {
		if (next === shownStatus) return;
		shownStatus = next;
		if (prefersReducedMotion.current) return;
		dot?.animate([{ scale: '1' }, { scale: `${pulseScale}` }, { scale: '1' }], {
			duration: pulseMs,
			easing: softEasing
		});
	}

	$effect(() => {
		const next = status;
		latestStatus = next;
		if (next === untrack(() => shownStatus)) return;
		untrack(() => recolor(next));
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
	class="pointer-events-none relative -my-4 flex h-[120px] w-[120px] shrink-0 items-center justify-center"
>
	<span data-avatar class="group/avatar pointer-events-auto relative block h-[88px] w-[88px]">
		<span
			data-avatar-face
			class="relative flex h-full w-full items-center justify-center rounded-full bg-[#38383c] text-[30px] font-medium text-ink ring-[6px] ring-surface"
		>
			<span
				data-avatar-initials
				class="block transition-opacity duration-150 {onpick
					? 'group-hover/avatar:opacity-0'
					: ''} {showInitials ? '' : 'invisible'}"
			>
				{initials(name)}
			</span>
			{#if shownUrl}
				<img
					src={shownUrl}
					alt=""
					draggable="false"
					transition:fade={{ duration: 150 }}
					class="absolute inset-0 h-full w-full rounded-full object-cover"
				/>
			{/if}
		</span>
		{#if onpick}
			<button
				type="button"
				aria-label="Изменить фото"
				onclick={(event) => onpick(event.currentTarget)}
				transition:fade={{ duration: 150 }}
				class="group absolute inset-0 flex items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-black/45 focus-visible:bg-black/45"
			>
				<Icon
					name="camera"
					size={22}
					class="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
				/>
			</button>
		{/if}
		<span
			bind:this={dot}
			data-avatar-dot
			class="absolute right-0.5 bottom-0.5 h-5 w-5 rounded-full border-4 border-surface {statusDotClass[
				shownStatus
			]} {online ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}"
			style:transition={prefersReducedMotion.current
				? 'opacity 200ms, scale 200ms'
				: `opacity 200ms ${softEasing}, scale 200ms ${softEasing}, background-color ${recolorMs}ms ${softEasing}`}
		></span>
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
