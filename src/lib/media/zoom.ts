export type Zoom = { scale: number; x: number; y: number };
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

export const minZoom = 1;
export const maxZoom = 5;
export const unzoomed: Zoom = { scale: 1, x: 0, y: 0 };

function limit(value: number, bound: number): number {
	return Math.min(bound, Math.max(-bound, value));
}

export function clampZoom(zoom: Zoom, frame: Size, viewport: Size): Zoom {
	if (zoom.scale <= minZoom) return unzoomed;
	return {
		scale: zoom.scale,
		x: limit(zoom.x, Math.max(0, (frame.width * zoom.scale - viewport.width) / 2)),
		y: limit(zoom.y, Math.max(0, (frame.height * zoom.scale - viewport.height) / 2))
	};
}

export function zoomAt(zoom: Zoom, scale: number, point: Point, frame: Size, viewport: Size): Zoom {
	const next = Math.min(maxZoom, Math.max(minZoom, scale));
	const contentX = (point.x - zoom.x) / zoom.scale;
	const contentY = (point.y - zoom.y) / zoom.scale;
	return clampZoom(
		{ scale: next, x: point.x - contentX * next, y: point.y - contentY * next },
		frame,
		viewport
	);
}

export function panBy(zoom: Zoom, shift: Point, frame: Size, viewport: Size): Zoom {
	return clampZoom({ ...zoom, x: zoom.x + shift.x, y: zoom.y + shift.y }, frame, viewport);
}
