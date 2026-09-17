import type { Member } from '$lib/servers/members';

export interface MockFriend extends Member {
	pending?: boolean;
}

export const mockFriends: MockFriend[] = [
	{ id: 'nika', name: 'Nika', username: 'nika', online: true, owner: false, pending: true },
	{ id: 'alina', name: 'Alina K', username: 'alina_k', online: true, owner: false },
	{ id: 'max', name: 'Max Orbit', username: 'max_orbit', online: true, owner: false },
	{ id: 'sergey', name: 'Sergey M', username: 'sergey_m', online: false, owner: false },
	{ id: 'lena', name: 'Lena Star', username: 'lena_star', online: false, owner: false },
	{ id: 'dmitry', name: 'Dmitry', username: 'dmitry', online: false, owner: false }
];
