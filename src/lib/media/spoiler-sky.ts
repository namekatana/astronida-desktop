import type { ScreenPoint } from './spoilers.svelte';

interface Star {
	x: number;
	y: number;
	depth: number;
	size: number;
	glow: boolean;
	peak: number;
	period: number;
	phase: number;
	vx: number;
	vy: number;
	dirX: number;
	dirY: number;
}

interface SkyOptions {
	reducedMotion: boolean;
	areaPerStar?: number;
	revealed?: () => { origin: ScreenPoint | null } | null;
	onresize?: (width: number, height: number) => void;
}

export interface SpoilerSky {
	setActive(active: boolean): void;
	stop(): void;
}

const areaPerStar = 900;
const minStars = 12;
const maxStars = 160;
const nearShare = 0.3;
const glowShare = 0.35;
const glowRadius = 4;
const maxPixelRatio = 2;
const minPeriodSeconds = 3;
const maxPeriodSeconds = 6;
const maxDriftSpeed = 2;
const parallaxFar = 3;
const parallaxNear = 8;
const parallaxEasing = 0.08;
const warpMs = 450;
const warpStartSpeed = 60;
const warpEndSpeed = 960;
const maxStreak = 42;
const maxFrameSeconds = 0.05;

function between(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function glowSprite(): HTMLCanvasElement {
	const size = glowRadius * 2 * maxPixelRatio;
	const sprite = document.createElement('canvas');
	sprite.width = size;
	sprite.height = size;
	const context = sprite.getContext('2d');
	if (!context) return sprite;
	const center = size / 2;
	const gradient = context.createRadialGradient(center, center, 0, center, center, center);
	gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
	gradient.addColorStop(0.35, 'rgba(255,255,255,0.18)');
	gradient.addColorStop(1, 'rgba(255,255,255,0)');
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);
	return sprite;
}

export function startSpoilerSky(
	host: HTMLElement,
	canvas: HTMLCanvasElement,
	options: SkyOptions
): SpoilerSky {
	const context = canvas.getContext('2d');
	const glow = glowSprite();
	let width = 0;
	let height = 0;
	let pixelRatio = 1;
	let stars: Star[] = [];
	let laidOut = { width: 0, height: 0 };
	let onScreen = false;
	let active = true;
	let pointer = { x: 0, y: 0 };
	let parallax = { x: 0, y: 0 };
	let warp: { start: number } | null = null;
	let frame = 0;
	let lastTime = 0;

	function createStar(): Star {
		const near = Math.random() < nearShare;
		const angle = Math.random() * Math.PI * 2;
		const drift = Math.random() * maxDriftSpeed;
		return {
			x: Math.random() * width,
			y: Math.random() * height,
			depth: near ? 1 : 0,
			size: near ? between(1.5, 2) : 1,
			glow: near && Math.random() < glowShare,
			peak: near ? between(0.6, 1) : between(0.35, 0.7),
			period: between(minPeriodSeconds, maxPeriodSeconds),
			phase: Math.random() * Math.PI * 2,
			vx: Math.cos(angle) * drift,
			vy: Math.sin(angle) * drift,
			dirX: 0,
			dirY: 0
		};
	}

	function populate() {
		const area = options.areaPerStar ?? areaPerStar;
		const count = Math.round(Math.min(maxStars, Math.max(minStars, (width * height) / area)));
		stars = Array.from({ length: count }, createStar);
	}

	function stretchStars() {
		for (const star of stars) {
			star.x = (star.x / laidOut.width) * width;
			star.y = (star.y / laidOut.height) * height;
		}
	}

	function resize(nextWidth: number, nextHeight: number) {
		width = nextWidth;
		height = nextHeight;
		pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		if (width > 0 && height > 0) {
			if (stars.length === 0) populate();
			else stretchStars();
			laidOut = { width, height };
		}
		options.onresize?.(width, height);
		draw(performance.now());
	}

	function startWarp(origin: ScreenPoint | null, now: number) {
		const box = host.getBoundingClientRect();
		const x = origin ? origin.x - box.left : width / 2;
		const y = origin ? origin.y - box.top : height / 2;
		warp = { start: now };
		for (const star of stars) {
			const dx = star.x - x;
			const dy = star.y - y;
			const distance = Math.hypot(dx, dy) || 1;
			star.dirX = dx / distance;
			star.dirY = dy / distance;
		}
	}

	function warpProgress(now: number): number {
		return warp ? Math.min(1, (now - warp.start) / warpMs) : 0;
	}

	function warpSpeed(progress: number): number {
		return warpStartSpeed + (warpEndSpeed - warpStartSpeed) * progress * progress;
	}

	function step(seconds: number, now: number) {
		if (!warp) {
			const revealed = options.revealed?.();
			if (revealed) startWarp(revealed.origin, now);
		}
		parallax = {
			x: parallax.x + (pointer.x - parallax.x) * parallaxEasing,
			y: parallax.y + (pointer.y - parallax.y) * parallaxEasing
		};
		const speed = warp ? warpSpeed(warpProgress(now)) : 0;
		for (const star of stars) {
			if (warp) {
				star.x += star.dirX * speed * seconds;
				star.y += star.dirY * speed * seconds;
				continue;
			}
			star.x = (star.x + star.vx * seconds + width) % width;
			star.y = (star.y + star.vy * seconds + height) % height;
		}
	}

	function twinkle(star: Star, now: number): number {
		const wave = Math.sin((now / 1000) * ((Math.PI * 2) / star.period) + star.phase);
		return star.peak * (0.35 + 0.65 * (0.5 + 0.5 * wave));
	}

	function draw(now: number) {
		if (!context) return;
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		context.clearRect(0, 0, width, height);
		const progress = warpProgress(now);
		const fade = warp ? 1 - progress : 1;
		const streak = warp ? Math.min(maxStreak, warpSpeed(progress) * 0.045) : 0;
		context.fillStyle = '#fff';
		context.strokeStyle = '#fff';
		for (const star of stars) {
			const shift = star.depth ? parallaxNear : parallaxFar;
			const x = star.x - parallax.x * shift;
			const y = star.y - parallax.y * shift;
			const alpha = twinkle(star, now) * fade;
			if (alpha <= 0.02) continue;
			context.globalAlpha = alpha;
			if (warp) {
				context.lineWidth = star.size;
				context.beginPath();
				context.moveTo(x - star.dirX * streak, y - star.dirY * streak);
				context.lineTo(x, y);
				context.stroke();
				continue;
			}
			if (star.glow) {
				context.drawImage(glow, x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
			}
			context.beginPath();
			context.arc(x, y, star.size / 2, 0, Math.PI * 2);
			context.fill();
		}
		context.globalAlpha = 1;
	}

	function shouldRun(): boolean {
		if (options.reducedMotion || !context) return false;
		if (warp) return warpProgress(performance.now()) < 1;
		return (onScreen && active) || Boolean(options.revealed?.());
	}

	function tick(time: number) {
		frame = 0;
		const seconds = lastTime ? Math.min(maxFrameSeconds, (time - lastTime) / 1000) : 0;
		lastTime = time;
		step(seconds, time);
		draw(time);
		schedule();
	}

	function schedule() {
		if (frame) return;
		if (!shouldRun()) {
			lastTime = 0;
			return;
		}
		frame = requestAnimationFrame(tick);
	}

	function handlePointerMove(event: PointerEvent) {
		const box = host.getBoundingClientRect();
		pointer = {
			x: ((event.clientX - box.left) / box.width - 0.5) * 2,
			y: ((event.clientY - box.top) / box.height - 0.5) * 2
		};
	}

	function handlePointerLeave() {
		pointer = { x: 0, y: 0 };
	}

	const sizeObserver = new ResizeObserver(([entry]) => {
		const box = entry.contentRect;
		if (box.width === width && box.height === height) return;
		resize(box.width, box.height);
	});
	const visibilityObserver = new IntersectionObserver(([entry]) => {
		onScreen = entry.isIntersecting;
		schedule();
	});
	sizeObserver.observe(host);
	visibilityObserver.observe(host);
	if (!options.reducedMotion) {
		host.addEventListener('pointermove', handlePointerMove);
		host.addEventListener('pointerleave', handlePointerLeave);
	}

	return {
		setActive(value: boolean) {
			active = value;
			schedule();
		},
		stop() {
			cancelAnimationFrame(frame);
			frame = 0;
			sizeObserver.disconnect();
			visibilityObserver.disconnect();
			host.removeEventListener('pointermove', handlePointerMove);
			host.removeEventListener('pointerleave', handlePointerLeave);
		}
	};
}
