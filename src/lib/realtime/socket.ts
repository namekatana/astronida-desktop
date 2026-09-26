import { PUBLIC_PHOENIX_URL } from '$env/static/public';
import { Socket } from 'phoenix';
import { untrack } from 'svelte';
import { auth } from '$lib/auth/session.svelte';
import { supabase } from '$lib/supabase/client';
import { connection } from './connection.svelte';

const ticketUrl = PUBLIC_PHOENIX_URL.replace(/^ws/, 'http').replace(
	/\/socket$/,
	'/api/socket/ticket'
);

const ticketTimeoutMs = 10_000;
const spareTicketRefreshMs = 4 * 60_000;

let socket: Socket | null = null;
let ticket = '';
let pendingTicket: Promise<void> | null = null;
let spareRefreshTimer: ReturnType<typeof setInterval> | null = null;
let stopWatchingToken: (() => void) | null = null;

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

function startSpareRefresh() {
	stopSpareRefresh();
	spareRefreshTimer = setInterval(() => void refreshTicket(), spareTicketRefreshMs);
}

function stopSpareRefresh() {
	if (spareRefreshTimer) clearInterval(spareRefreshTimer);
	spareRefreshTimer = null;
}

function watchTokenRefresh() {
	const { data } = supabase.auth.onAuthStateChange((event) => {
		if (event === 'TOKEN_REFRESHED' && socket?.isConnected()) void refreshTicket();
	});
	stopWatchingToken = () => data.subscription.unsubscribe();
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
		startSpareRefresh();
	});
	created.onClose(() => {
		if (socket !== created) return;
		connection.setSocketOpen(false);
		stopSpareRefresh();
		void refreshTicket();
	});
	socket = created;
	watchTokenRefresh();
	void refreshTicket().then(() => {
		if (socket === created) created.connect();
	});
	return created;
}

export function disconnectPhoenix(): void {
	connection.setTracking(false);
	stopSpareRefresh();
	stopWatchingToken?.();
	stopWatchingToken = null;
	socket?.disconnect();
	socket = null;
	ticket = '';
}
