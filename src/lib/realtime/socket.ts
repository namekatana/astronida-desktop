import { PUBLIC_PHOENIX_URL } from '$env/static/public';
import { Socket } from 'phoenix';
import { auth } from '$lib/auth/session.svelte';


let socket: Socket | null = null;

export function phoenixSocket(): Socket {
	if (socket) return socket;

	socket = new Socket(PUBLIC_PHOENIX_URL, {
		params: () => ({ token: auth.session?.access_token ?? '' })
	});
	socket.connect();
	return socket;
}

export function disconnectPhoenix(): void {
	socket?.disconnect();
	socket = null;
}
