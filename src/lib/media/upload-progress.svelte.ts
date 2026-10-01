import { SvelteMap, SvelteSet } from 'svelte/reactivity';

export const uploadProgress = new SvelteMap<string, number>();

export const waitingForNetwork = new SvelteSet<string>();
