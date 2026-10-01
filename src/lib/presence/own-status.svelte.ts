import { pushStatus } from '$lib/notifications/inbox';
import { userStatusFrom, type UserStatus } from './status';

const storageKey = 'astronida.status';

function readStored(): UserStatus {
	try {
		return userStatusFrom(localStorage.getItem(storageKey)) ?? 'online';
	} catch {
		return 'online';
	}
}

function store(status: UserStatus) {
	try {
		localStorage.setItem(storageKey, status);
	} catch {
		return;
	}
}

let current = $state<UserStatus>(readStored());
let unsynced = false;

async function announce(status: UserStatus) {
	unsynced = !(await pushStatus(status));
}

export const ownStatus = {
	get current() {
		return current;
	},
	get quiet() {
		return current === 'dnd';
	},
	choose(status: UserStatus) {
		if (status === current) return;
		current = status;
		store(status);
		void announce(status);
	},
	adopt(status: UserStatus) {
		current = status;
		store(status);
	},
	restore(serverStatus: UserStatus | null) {
		if (serverStatus && !unsynced) this.adopt(serverStatus);
		else if (serverStatus !== current) void announce(current);
	}
};
