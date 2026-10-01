import { on } from 'svelte/events';
import type { SmoothScrollController } from '$lib/ui/smooth-scroll';

export interface SettingsSection {
	id: string;
	title: string;
}

const pageInset = 20;
const transitionZone = 96;

function clampUnit(value: number): number {
	return Math.min(Math.max(value, 0), 1);
}

function spreadUnreachable(stops: number[], max: number): number[] {
	const firstAtEnd = stops.findIndex((stop) => stop >= max);
	if (firstAtEnd < 0 || firstAtEnd === stops.length - 1) return stops;
	const start = firstAtEnd === 0 ? 0 : stops[firstAtEnd - 1];
	const count = stops.length - firstAtEnd;
	return stops.map((stop, index) =>
		index < firstAtEnd ? stop : start + ((max - start) * (index - firstAtEnd + 1)) / count
	);
}

function sectionTitle(section: HTMLElement): string {
	const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
	return heading?.textContent?.trim() ?? '';
}

export function createSectionSpy() {
	let progress = $state(0);
	let scrollable = $state(false);
	let elements: HTMLElement[] = [];
	let stops: number[] = [];
	let viewport: HTMLElement | null = null;
	let controller: SmoothScrollController | undefined;
	let pinned: number | null = null;

	function maxScroll(): number {
		return viewport ? Math.max(viewport.scrollHeight - viewport.clientHeight, 0) : 0;
	}

	function scrollPosition(): number {
		return controller?.position ?? viewport?.scrollTop ?? 0;
	}

	function update() {
		if (stops.length === 0 || maxScroll() === 0) {
			progress = pinned ?? 0;
			return;
		}
		const position = scrollPosition();
		let index = 0;
		stops.forEach((stop, stopIndex) => {
			if (stop <= position + 0.5) index = stopIndex;
		});
		const next = stops[index + 1];
		if (next === undefined) {
			progress = index;
			return;
		}
		const zone = Math.min(transitionZone, next - stops[index]);
		progress = zone > 0 ? index + clampUnit((position - (next - zone)) / zone) : index;
	}

	function measure() {
		if (!viewport) return;
		const viewportTop = viewport.getBoundingClientRect().top;
		const position = scrollPosition();
		const max = maxScroll();
		scrollable = max > 0;
		const raw = elements.map((element) => {
			const offset = position + element.getBoundingClientRect().top - viewportTop - pageInset;
			return Math.min(Math.max(offset, 0), max);
		});
		stops = spreadUnreachable(raw, max);
		update();
	}

	function attach(
		page: HTMLElement,
		scrollViewport: HTMLElement,
		scrollController: SmoothScrollController | undefined
	): { sections: SettingsSection[]; detach: () => void } {
		viewport = scrollViewport;
		controller = scrollController;
		pinned = null;
		elements = Array.from(page.querySelectorAll<HTMLElement>('section[aria-labelledby]'));
		measure();
		const offScroll = on(scrollViewport, 'scroll', update, { passive: true });
		const observer = new ResizeObserver(measure);
		observer.observe(page);
		observer.observe(scrollViewport);
		return {
			sections: elements.map((element) => ({
				id: element.getAttribute('aria-labelledby') ?? '',
				title: sectionTitle(element)
			})),
			detach: () => {
				offScroll();
				observer.disconnect();
				elements = [];
				stops = [];
			}
		};
	}

	function scrollTo(index: number) {
		if (maxScroll() === 0) {
			pinned = index;
			update();
			return;
		}
		const stop = stops[index];
		if (stop !== undefined) controller?.scrollTo(stop);
	}

	return {
		get progress() {
			return progress;
		},
		get scrollable() {
			return scrollable;
		},
		attach,
		scrollTo
	};
}
