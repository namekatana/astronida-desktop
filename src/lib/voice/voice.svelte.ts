import {
	requestVoiceKey,
	requestVoiceToken,
	type VoiceCredentials
} from '$lib/presence/presence';
import { createLiveKitTransport, warmUp } from './livekit-transport';
import { qualityFromStats, worstQuality } from './quality';
import { playToggleSound } from './sounds';
import type { TransportState, VoiceQuality, VoiceStats, VoiceTransport } from './transport';

export interface VoiceConnection {
	serverId: string;
	serverName: string;
	channelId: string;
	channelName: string;
}

export type VoiceStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type VoiceFailure = 'duplicate' | 'removed' | 'error';

const tokenSafetyMs = 5 * 60 * 1000;
const retryBaseMs = 1000;
const retryMaxMs = 10_000;

let micMuted = $state(false);
let deafened = $state(false);
let connected = $state<VoiceConnection | null>(null);
let status = $state<VoiceStatus | null>(null);
let failure = $state<VoiceFailure | null>(null);
let quality = $state<VoiceQuality | null>(null);
let stats = $state<VoiceStats | null>(null);
let speakingIds = $state<string[]>([]);
let participantQuality = $state<Record<string, VoiceQuality>>({});
let participantStats = $state<Record<string, VoiceStats>>({});
let encrypted = $state(false);
let micMutedBeforeDeafen = false;

let transport: VoiceTransport | null = null;
let attempt = 0;
let keyVersion = 0;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let onlineListener: (() => void) | null = null;

const credentialsCache = new Map<string, VoiceCredentials>();
const pendingTokens = new Map<string, Promise<VoiceCredentials | null>>();

function cachedCredentials(channelId: string): VoiceCredentials | null {
	const cached = credentialsCache.get(channelId);
	if (!cached) return null;
	if (cached.expiresAt - tokenSafetyMs <= Date.now()) {
		credentialsCache.delete(channelId);
		return null;
	}
	return cached;
}

function fetchCredentials(serverId: string, channelId: string): Promise<VoiceCredentials | null> {
	const cached = cachedCredentials(channelId);
	if (cached) return Promise.resolve(cached);
	const pending = pendingTokens.get(channelId);
	if (pending) return pending;

	const request = requestVoiceToken(serverId, channelId)
		.then((result) => {
			if (!result.ok) return null;
			credentialsCache.set(channelId, result.value);
			warmUp(result.value.url);
			return result.value;
		})
		.finally(() => pendingTokens.delete(channelId));
	pendingTokens.set(channelId, request);
	return request;
}

function microphoneEnabled() {
	return !micMuted && !deafened;
}

function releaseTransport() {
	const current = transport;
	transport = null;
	if (current) void current.disconnect();
}

function cancelRetry() {
	if (retryTimer) clearTimeout(retryTimer);
	retryTimer = null;
	if (onlineListener) window.removeEventListener('online', onlineListener);
	onlineListener = null;
}

function resetLiveState() {
	quality = null;
	stats = null;
	speakingIds = [];
	participantQuality = {};
	participantStats = {};
	encrypted = false;
}

function scheduleReconnect(target: VoiceConnection) {
	const current = attempt;
	cancelRetry();
	releaseTransport();
	status = 'reconnecting';
	resetLiveState();

	const delay = Math.min(retryBaseMs * 2 ** retryCount, retryMaxMs) + Math.random() * 500;
	retryCount++;

	const start = () => {
		cancelRetry();
		if (current !== attempt) return;
		void establish(target, { reconnect: true, attemptId: current });
	};

	const waitForOnline = () => {
		if (navigator.onLine) {
			start();
			return;
		}
		onlineListener = start;
		window.addEventListener('online', onlineListener, { once: true });
	};

	retryTimer = setTimeout(waitForOnline, delay);
}

function failWith(reason: VoiceFailure) {
	cancelRetry();
	releaseTransport();
	status = 'failed';
	failure = reason;
	resetLiveState();
}

async function establish(
	target: VoiceConnection,
	options: { reconnect: boolean; attemptId: number }
) {
	const current = options.attemptId;
	const credentials = await fetchCredentials(target.serverId, target.channelId);
	if (current !== attempt) return;
	if (!credentials) {
		if (options.reconnect) scheduleReconnect(target);
		else failWith('error');
		return;
	}

	const next = createLiveKitTransport({
		onState: (state) => {
			if (transport !== next) return;
			handleTransportState(state, target);
		},
		onQuality: (next_quality) => {
			if (transport === next) quality = next_quality;
		},
		onParticipantQuality: (userId, next_quality) => {
			if (transport !== next) return;
			if (next_quality === null) delete participantQuality[userId];
			else participantQuality[userId] = next_quality;
		},
		onParticipantStats: (userId, next_stats) => {
			if (transport !== next) return;
			if (next_stats === null) delete participantStats[userId];
			else participantStats[userId] = next_stats;
		},
		onEncryption: (next_encrypted) => {
			if (transport === next) encrypted = next_encrypted;
		},
		onStats: (next_stats) => {
			if (transport === next) stats = next_stats;
		},
		onSpeaking: (ids) => {
			if (transport === next) speakingIds = ids;
		}
	});
	transport = next;

	try {
		await next.connect(credentials, { microphone: microphoneEnabled() });
	} catch {
		if (current !== attempt || transport !== next) return;
		credentialsCache.delete(target.channelId);
		if (options.reconnect) scheduleReconnect(target);
		else failWith('error');
		return;
	}
	if (current !== attempt || transport !== next) return;

	retryCount = 0;
	status = 'connected';
	failure = null;
	keyVersion = credentials.e2ee.version;
	if (!options.reconnect) playToggleSound('voice-connected');
	next.setDeafened(deafened);
	void syncKey(target, next);
}

async function syncKey(target: VoiceConnection, owner: VoiceTransport) {
	const latest = await requestVoiceKey(target.serverId, target.channelId);
	if (!latest || transport !== owner || latest.version <= keyVersion) return;
	keyVersion = latest.version;
	await owner.rotateKey(latest);
}

function handleTransportState(state: TransportState, target: VoiceConnection) {
	if (state.kind === 'reconnecting') {
		status = 'reconnecting';
		return;
	}
	if (state.kind === 'connected') {
		status = 'connected';
		retryCount = 0;
		return;
	}
	switch (state.cause) {
		case 'client':
			return;
		case 'duplicate':
		case 'removed':
			failWith(state.cause);
			return;
		case 'network':
			scheduleReconnect(target);
	}
}

export const voice = {
	get micMuted() {
		return deafened || micMuted;
	},
	get deafened() {
		return deafened;
	},
	get connected() {
		return connected;
	},
	get status() {
		return status;
	},
	get failure() {
		return failure;
	},
	get quality() {
		return worstQuality(qualityFromStats(stats), quality);
	},
	get stats() {
		return stats;
	},
	get speakingIds() {
		return speakingIds;
	},
	get participantQuality() {
		return participantQuality;
	},
	get participantStats() {
		return participantStats;
	},
	get encrypted() {
		return encrypted;
	},

	toggleMic() {
		if (deafened) {
			deafened = false;
			micMuted = false;
		} else {
			micMuted = !micMuted;
		}
		transport?.setDeafened(deafened);
		void transport?.setMicrophoneEnabled(microphoneEnabled());
		playToggleSound(micMuted ? 'mic-off' : 'mic-on');
	},

	toggleDeafen() {
		if (deafened) {
			deafened = false;
			micMuted = micMutedBeforeDeafen;
		} else {
			micMutedBeforeDeafen = micMuted;
			deafened = true;
		}
		transport?.setDeafened(deafened);
		void transport?.setMicrophoneEnabled(microphoneEnabled());
		playToggleSound(deafened ? 'deafen-on' : 'deafen-off');
	},

	prefetch(target: { serverId: string; channelId: string }) {
		void fetchCredentials(target.serverId, target.channelId);
	},

	handleKeyRotation(serverId: string, channelId: string, version: number) {
		credentialsCache.delete(channelId);
		const owner = transport;
		if (!owner || !connected) return;
		if (connected.serverId !== serverId || connected.channelId !== channelId) return;
		if (version <= keyVersion) return;
		void syncKey(connected, owner);
	},

	connect(target: VoiceConnection) {
		if (connected?.channelId === target.channelId && status !== 'failed') return;
		const current = ++attempt;
		cancelRetry();
		releaseTransport();
		retryCount = 0;
		connected = target;
		status = 'connecting';
		failure = null;
		resetLiveState();
		void establish(target, { reconnect: false, attemptId: current });
	},

	disconnect() {
		attempt++;
		cancelRetry();
		releaseTransport();
		if (status === 'connected') playToggleSound('voice-disconnected');
		connected = null;
		status = null;
		failure = null;
		keyVersion = 0;
		resetLiveState();
	}
};
