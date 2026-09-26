import { PUBLIC_PHOENIX_URL } from '$env/static/public';
import { Socket } from 'phoenix';
import { untrack } from 'svelte';
import { auth } from '$lib/auth/session.svelte';
import { connection } from './connection.svelte';

const ticketUrl = PUBLIC_PHOENIX_URL.replace(/^ws/, 'http').replace(
	/\/socket$/,
	'/api/socket/ticket'
);

const ticketTimeoutMs = 10_000;

let socket: Socket | null = null;
let ticket = '';
let pendingTicket: Promise<void> | null = null;

async function fetchTicket(): Promise<string> {
	const token = untrack(() => auth.session?.access_token);
	if (!token) return '';
	try {
		const response = await fetch(ticketUrl, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(ticketTimeoutMs)
		});
		if (!response.ok) return '';
		const body = (await response.json()) as { ticket?: unknown };
		return typeof body.ticket === 'string' ? body.ticket : '';
	} catch {
		return '';
	}
}

function refreshTicket(): Promise<void> {
	if (pendingTicket) return pendingTicket;
	pendingTicket = fetchTicket()
		.then((next) => {
			ticket = next;
		})
		.finally(() => {
			pendingTicket = null;
		});
	return pendingTicket;
}

function keepReconnectingWhileHidden(target: Socket) {
	Object.defineProperty(target, 'pageHidden', { get: () => false });
}


export function phoenixSocket(): Socket {
	if (socket) return socket;

	const created = new Socket(PUBLIC_PHOENIX_URL, { params: () => ({ ticket }) });
	keepReconnectingWhileHidden(created);
	connection.setTracking(true);
	created.onOpen(() => {
		ticket = '';
		connection.setSocketOpen(true);
		void refreshTicket();
	});
	created.onClose(() => {
		if (socket !== created) return;
		connection.setSocketOpen(false);
		void refreshTicket();
	});
	socket = created;
	void refreshTicket().then(() => {
		if (socket === created) created.connect();
	});
	return created;
}

export function disconnectPhoenix(): void {
	connection.setTracking(false);
	socket?.disconnect();
	socket = null;
	ticket = '';
}
