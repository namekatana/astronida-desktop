import { getContext, setContext } from 'svelte';
import type { AppState } from './app-state.svelte';
import type { ModerationActions } from './moderation-actions';
import type { Overlays } from './overlays.svelte';
import type { ProfileActions } from './profile-actions.svelte';

export interface AppContext {
	app: AppState;
	overlays: Overlays;
	profiles: ProfileActions;
	moderation: ModerationActions;
}

const contextKey = Symbol('app');

export function setAppContext(context: AppContext) {
	setContext(contextKey, context);
}

export function appContext(): AppContext {
	return getContext<AppContext>(contextKey);
}
