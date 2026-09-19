import { requestVoiceToken } from '$lib/messages/messages';
import { createLiveKitTransport } from './livekit-transport';
import { playToggleSound } from './sounds';
import type { VoiceTransport } from './transport';

export interface VoiceConnection {
	serverId: string;
	serverName: string;
	channelId: string;
	channelName: string;
}

export type VoiceStatus = 'connecting' | 'connected' | 'failed';

let micMuted = $state(false);
let deafened = $state(false);
let connected = $state<VoiceConnection | null>(null);
let status = $state<VoiceStatus | null>(null);
let ping = $state<number | null>(null);
let micMutedBeforeDeafen = false;

let transport: VoiceTransport | null = null;
let attempt = 0;

function releaseTransport() {
	const current = transport;
	transport = null;
	if (current) void current.disconnect();
}

function microphoneEnabled() {
	return !micMuted && !deafened;
}

async function establish(target: VoiceConnection) {
	const current = ++attempt;
	releaseTransport();
	connected = target;
	status = 'connecting';
	ping = null;

	const credentials = await requestVoiceToken(target.channelId);
	if (current !== attempt) return;
	if (!credentials.ok) {
		status = 'failed';
		return;
	}

	const next = createLiveKitTransport({
		onPing: (ms) => {
			if (transport === next) ping = ms;
		},
		onDisconnected: () => {
			if (transport === next) status = 'failed';
		}
	});
	transport = next;

	try {
		await next.connect(credentials.value);
	} catch {
		if (current === attempt) status = 'failed';
		return;
	}
	if (current !== attempt) return;
	status = 'connected';
	playToggleSound('voice-connected');
	next.setDeafened(deafened);

	try {
		await next.setMicrophoneEnabled(microphoneEnabled());
	} catch {
		if (current === attempt) micMuted = true;
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
	get ping() {
		return ping;
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

	connect(target: VoiceConnection) {
		if (connected?.channelId === target.channelId && status !== 'failed') return;
		void establish(target);
	},

	disconnect() {
		attempt++;
		releaseTransport();
		if (status === 'connected') playToggleSound('voice-disconnected');
		connected = null;
		status = null;
		ping = null;
	}
};
