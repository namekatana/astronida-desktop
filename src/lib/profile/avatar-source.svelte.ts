import { untrack } from 'svelte';
import { cachedAvatar, loadAvatar, type AvatarVariant } from './avatar-images';

export interface AvatarRequest {
	userId: string;
	avatarId: string | null;
	variant: AvatarVariant;
}

export function createAvatarSource(request: () => AvatarRequest) {
	const initial = untrack(request);
	let url = $state(initial.avatarId ? cachedAvatar(initial.avatarId, initial.variant) : null);
	let failed = $state(false);

	$effect(() => {
		const { userId, avatarId, variant } = request();
		failed = false;
		if (!avatarId) {
			url = null;
			return;
		}
		const cached = cachedAvatar(avatarId, variant);
		if (cached) {
			url = cached;
			return;
		}
		let active = true;
		void loadAvatar(userId, avatarId, variant).then((loaded) => {
			if (!active) return;
			url = loaded;
			failed = loaded === null;
		});
		return () => {
			active = false;
		};
	});

	return {
		get url() {
			return url;
		},
		get failed() {
			return failed;
		}
	};
}
