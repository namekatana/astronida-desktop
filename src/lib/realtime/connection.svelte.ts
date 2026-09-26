export type ConnectionStatus = 'idle' | 'connecting' | 'updating' | 'ready';

let tracking = $state(false);
let socketOpen = $state(false);
let updating = $state(false);

export const connection = {
	get status(): ConnectionStatus {
		if (!tracking) return 'idle';
		if (!socketOpen) return 'connecting';
		return updating ? 'updating' : 'ready';
	},
	setTracking(value: boolean) {
		tracking = value;
		if (!value) {
			socketOpen = false;
			updating = false;
		}
	},
	setSocketOpen(open: boolean) {
		socketOpen = open;
	},
	setUpdating(value: boolean) {
		updating = value;
	}
};
