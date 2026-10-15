import type { Member } from '$lib/members/members';
import type { VoiceQuality, VoiceStats } from './transport';

export interface VoiceOccupant extends Member {
	self: boolean;
	micMuted: boolean;
	deafened: boolean;
	speaking: boolean;
	quality: VoiceQuality | null;
	stats: VoiceStats | null;
}
