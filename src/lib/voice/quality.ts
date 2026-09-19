import type { VoiceQuality, VoiceStats } from './transport';

const qualityRank: Record<VoiceQuality, number> = { lost: 0, poor: 1, good: 2, excellent: 3 };

export function qualityFromStats(stats: VoiceStats | null | undefined): VoiceQuality | null {
	if (!stats || stats.rttMs === null) return null;
	const loss = stats.lossPercent ?? 0;
	if (stats.rttMs < 100 && loss < 2) return 'excellent';
	if (stats.rttMs < 200 && loss < 5) return 'good';
	return 'poor';
}

export function worstQuality(
	a: VoiceQuality | null | undefined,
	b: VoiceQuality | null | undefined
): VoiceQuality | null {
	if (!a) return b ?? null;
	if (!b) return a;
	return qualityRank[a] <= qualityRank[b] ? a : b;
}

export function qualityBars(quality: VoiceQuality): number {
	return quality === 'excellent' ? 3 : quality === 'good' ? 2 : quality === 'poor' ? 1 : 0;
}

export function qualityColorClass(quality: VoiceQuality): string {
	return quality === 'excellent' ? 'text-online' : quality === 'good' ? 'text-warning' : 'text-danger';
}

export function describeStats(stats: VoiceStats | null | undefined, quality: VoiceQuality | null) {
	const parts: string[] = [];
	if (stats?.rttMs !== null && stats?.rttMs !== undefined) parts.push(`RTT ${Math.max(1, stats.rttMs)} мс`);
	if (stats?.lossPercent !== null && stats?.lossPercent !== undefined) {
		parts.push(`потери ${stats.lossPercent}%`);
	}
	if (quality === 'lost') parts.push('связь потеряна');
	return parts.join(' · ');
}
