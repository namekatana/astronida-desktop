export type ImageSize = { width: number; height: number };

export const feedMaxSide = 800;
export const standardMaxSide = 1280;
export const highQualityMaxSide = 2560;

export function fitWithin(width: number, height: number, maxSide: number): ImageSize {
	const longest = Math.max(width, height);
	if (longest <= maxSide) return { width, height };
	const scale = maxSide / longest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}
