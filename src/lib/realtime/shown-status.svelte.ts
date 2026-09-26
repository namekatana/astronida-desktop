import { untrack } from 'svelte';
import { connection, type ConnectionStatus } from './connection.svelte';

export type ShownStatus = 'connecting' | 'updating';

const statusDelayMs = 400;

let shown = $state<ShownStatus | null>(null);
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function asShown(status: ConnectionStatus): ShownStatus | null {
	return status === 'connecting' || status === 'updating' ? status : null;
}

function cancelPending() {
	if (pendingTimer) clearTimeout(pendingTimer);
	pendingTimer = null;
}

$effect.root(() => {
	$effect(() => {
		const status = asShown(connection.status);
		if (status === null) {
			cancelPending();
			shown = null;
			return;
		}
		if (untrack(() => shown) !== null) {
			shown = status;
			return;
		}
		pendingTimer ??= setTimeout(() => {
			pendingTimer = null;
			shown = asShown(connection.status);
		}, statusDelayMs);
	});
});

export const shownStatus = {
	get value(): ShownStatus | null {
		return shown;
	}
};
