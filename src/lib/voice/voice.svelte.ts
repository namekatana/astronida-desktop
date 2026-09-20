import {
	joinVoice,
	leaveVoice,
	requestVoiceKey,
	updateVoiceState,
	voiceUrl,
	type VoiceCredentials,
	type VoiceKey
} from '$lib/presence/presence';
import { keyFingerprint } from './fingerprint';
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
let fingerprint = $state<string | null>(null);
let micMutedBeforeDeafen = false;

let transport: VoiceTransport | null = null;
let attempt = 0;
let keyVersion = $state(0);
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let onlineListener: (() => void) | null = null;

function microphoneEnabled() {
	return !micMuted && !deafened;
}

function announcedState() {
	return { micMuted: deafened || micMuted, deafened };
}

async function fetchCredentials(target: VoiceConnection): Promise<VoiceCredentials | null> {
	const result = await joinVoice(target.serverId, {
		channelId: target.channelId,
		...announcedState()
	});
	return result.ok ? result.value : null;
}

function announceState() {
	if (connected) updateVoiceState(connected.serverId, announcedState());
}

function rememberKey(channelId: string, key: VoiceKey) {
	keyVersion = key.version;
	void keyFingerprint(channelId, key).then((code) => {
		if (keyVersion === key.version && connected?.channelId === channelId) fingerprint = code;
	});
}

function adoptKey(serverId: string, channelId: string, key: VoiceKey) {
	const owner = transport;
	if (!owner || !connected) return;
	if (connected.serverId !== serverId || connected.channelId !== channelId) return;
	if (key.version <= keyVersion) return;
	rememberKey(channelId, key);
	void owner.rotateKey(key);
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
	fingerprint = null;
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
	const credentials = await fetchCredentials(target);
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
		if (options.reconnect) scheduleReconnect(target);
		else failWith('error');
		return;
	}
	if (current !== attempt || transport !== next) return;

	retryCount = 0;
	status = 'connected';
	failure = null;
	rememberKey(target.channelId, credentials.e2ee);
	if (!options.reconnect) playToggleSound('voice-connected');
	next.setDeafened(deafened);
	void syncKey(target, next);
}

async function syncKey(target: VoiceConnection, owner: VoiceTransport) {
	const latest = await requestVoiceKey(target.serverId, target.channelId);
	if (!latest || transport !== owner) return;
	adoptKey(target.serverId, target.channelId, latest);
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
	get keyVersion() {
		return keyVersion;
	},
	get keyFingerprint() {
		return fingerprint;
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
		announceState();
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
		announceState();
		playToggleSound(deafened ? 'deafen-on' : 'deafen-off');
	},

	prefetch(serverId: string) {
		const url = voiceUrl(serverId);
		if (url) warmUp(url);
	},

	handleKeyRotation(serverId: string, channelId: string, version: number) {
		const owner = transport;
		if (!owner || !connected) return;
		if (connected.serverId !== serverId || connected.channelId !== channelId) return;
		if (version <= keyVersion) return;
		void syncKey(connected, owner);
	},

	handleRejoin(serverId: string, channelId: string, key: VoiceKey) {
		adoptKey(serverId, channelId, key);
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
		if (connected) leaveVoice(connected.serverId);
		if (status === 'connected') playToggleSound('voice-disconnected');
		connected = null;
		status = null;
		failure = null;
		keyVersion = 0;
		resetLiveState();
	}
};
