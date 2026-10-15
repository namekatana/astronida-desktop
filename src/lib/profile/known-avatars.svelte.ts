import { SvelteMap } from 'svelte/reactivity';
import { onAccountReset } from '$lib/auth/account-reset';

const avatars = new SvelteMap<string, string | null>();

export const knownAvatars = {
	has(userId: string): boolean {
		return avatars.has(userId);
	},
	of(userId: string): string | null {
		return avatars.get(userId) ?? null;
	},
	learn(userId: string, avatarId: string | null | undefined) {
		if (avatarId === undefined || avatars.get(userId) === avatarId) return;
		avatars.set(userId, avatarId);
	}
};

onAccountReset(() => avatars.clear());

export function avatarIdOf(userId: string, fallback: string | null | undefined): string | null {
	return knownAvatars.has(userId) ? knownAvatars.of(userId) : (fallback ?? null);
}
