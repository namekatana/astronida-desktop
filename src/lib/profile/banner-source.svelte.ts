import { untrack } from 'svelte';
import { cachedBanner, loadBanner } from './banner-images';

export interface BannerRequest {
	userId: string;
	bannerId: string | null;
}

export function createBannerSource(request: () => BannerRequest) {
	const initial = untrack(request);
	let url = $state(initial.bannerId ? cachedBanner(initial.bannerId) : null);

	$effect(() => {
		const { userId, bannerId } = request();
		if (!bannerId) {
			url = null;
			return;
		}
		const cached = cachedBanner(bannerId);
		if (cached) {
			url = cached;
			return;
		}
		let active = true;
		void loadBanner(userId, bannerId).then((loaded) => {
			if (active) url = loaded;
		});
		return () => {
			active = false;
		};
	});

	return {
		get url() {
			return url;
		}
	};
}
