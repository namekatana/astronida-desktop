export interface RosterChange {
	joined: string[];
	left: string[];
}

export interface RosterWatcher {
	update(roomKey: string | null, userIds: string[]): RosterChange;
}

export function createRosterWatcher(selfId: string): RosterWatcher {
	let watchedKey: string | null = null;
	let known = new Set<string>();

	return {
		update(roomKey, userIds) {
			const current = new Set(userIds.filter((id) => id !== selfId));
			if (roomKey !== watchedKey) {
				watchedKey = roomKey;
				known = current;
				return { joined: [], left: [] };
			}
			const joined = [...current].filter((id) => !known.has(id));
			const left = [...known].filter((id) => !current.has(id));
			known = current;
			return { joined, left };
		}
	};
}
