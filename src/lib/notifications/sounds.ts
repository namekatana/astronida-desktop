import { playToggleSound, type ToggleSound } from '$lib/voice/sounds';

const cooldownMs = 1000;

const lastPlayedAt = new Map<ToggleSound, number>();

function playWithCooldown(kind: ToggleSound) {
	const now = Date.now();
	if (now - (lastPlayedAt.get(kind) ?? 0) < cooldownMs) return;
	lastPlayedAt.set(kind, now);
	playToggleSound(kind);
}

export function playDirectMessageSound() {
	playWithCooldown('direct-message');
}

export function playFriendRequestSound() {
	playWithCooldown('friend-request');
}
