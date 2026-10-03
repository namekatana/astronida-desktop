const typingTtlMs = 5000;
const typingThrottleMs = 3000;

let typingByChannel = $state<Record<string, Record<string, string | null>>>({});
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(channelId: string, userId: string) {
	return `${channelId}:${userId}`;
}

export function markTyping(channelId: string, userId: string, username: string | null = null) {
	const key = timerKey(channelId, userId);
	const existing = timers.get(key);
	if (existing) clearTimeout(existing);
	timers.set(
		key,
		setTimeout(() => clearTyping(channelId, userId), typingTtlMs)
	);
	typingByChannel[channelId] = { ...typingByChannel[channelId], [userId]: username };
}

export function clearTyping(channelId: string, userId: string) {
	const key = timerKey(channelId, userId);
	const existing = timers.get(key);
	if (existing) clearTimeout(existing);
	timers.delete(key);
	const channel = typingByChannel[channelId];
	if (!channel || !(userId in channel)) return;
	typingByChannel[channelId] = Object.fromEntries(
		Object.entries(channel).filter(([id]) => id !== userId)
	);
}

export function typingIn(channelId: string): string[] {
	return Object.keys(typingByChannel[channelId] ?? {});
}

export function typingUsername(channelId: string, userId: string): string | null {
	return typingByChannel[channelId]?.[userId] ?? null;
}

export function createTypingSender(send: () => void) {
	let lastSentAt = 0;
	return {
		touch() {
			const now = Date.now();
			if (now - lastSentAt < typingThrottleMs) return;
			lastSentAt = now;
			send();
		},
		reset() {
			lastSentAt = 0;
		}
	};
}
