import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
	DisconnectCause,
	EncryptionKey,
	VoiceCredentials,
	VoiceQuality,
	VoiceStats,
	VoiceTransport,
	VoiceTransportHandlers
} from './transport';

const stateEvent = 'voice://state';
const participantEvent = 'voice://participant';
const speakingEvent = 'voice://speaking';
const qualityEvent = 'voice://quality';
const statsEvent = 'voice://stats';

interface StateEvent {
	generation: number;
	kind: 'connected' | 'reconnecting' | 'disconnected';
	cause?: DisconnectCause;
}

interface ParticipantEvent {
	generation: number;
	identity: string;
	kind: 'subscribed' | 'unsubscribed' | 'left';
}

interface SpeakingEvent {
	generation: number;
	identities: string[];
}

interface QualityEvent {
	generation: number;
	identity?: string;
	quality: VoiceQuality;
}

interface StatsEvent extends VoiceStats {
	generation: number;
	identity?: string;
}

interface Connected {
	generation: number;
	encrypted: boolean;
	participants: string[];
}

export function createNativeTransport(handlers: VoiceTransportHandlers): VoiceTransport {
	let generation: number | null = null;
	let closed = false;
	const unlisteners: UnlistenFn[] = [];

	function mine(event: { generation: number }) {
		return !closed && generation !== null && event.generation === generation;
	}

	function applyVolume(userId: string, volume: number) {
		void invoke('voice_set_volume', { userId, volume }).catch(() => {});
	}

	function handleParticipant(event: ParticipantEvent) {
		if (event.kind === 'subscribed') {
			applyVolume(event.identity, handlers.volumeFor(event.identity));
		} else if (event.kind === 'left') {
			handlers.onParticipantQuality(event.identity, null);
			handlers.onParticipantStats(event.identity, null);
		}
	}

	async function subscribe() {
		const listening = await Promise.all([
			listen<StateEvent>(stateEvent, ({ payload }) => {
				if (!mine(payload)) return;
				if (payload.kind === 'disconnected') {
					handlers.onState({ kind: 'disconnected', cause: payload.cause ?? 'network' });
				} else {
					handlers.onState({ kind: payload.kind });
				}
			}),
			listen<ParticipantEvent>(participantEvent, ({ payload }) => {
				if (mine(payload)) handleParticipant(payload);
			}),
			listen<SpeakingEvent>(speakingEvent, ({ payload }) => {
				if (mine(payload)) handlers.onSpeaking(payload.identities);
			}),
			listen<QualityEvent>(qualityEvent, ({ payload }) => {
				if (!mine(payload)) return;
				if (payload.identity === undefined) handlers.onQuality(payload.quality);
				else handlers.onParticipantQuality(payload.identity, payload.quality);
			}),
			listen<StatsEvent>(statsEvent, ({ payload }) => {
				if (!mine(payload)) return;
				const stats = { rttMs: payload.rttMs, lossPercent: payload.lossPercent };
				if (payload.identity === undefined) handlers.onStats(stats);
				else handlers.onParticipantStats(payload.identity, stats);
			})
		]);
		if (closed) {
			for (const unlisten of listening) unlisten();
			return;
		}
		unlisteners.push(...listening);
	}

	function unsubscribe() {
		for (const unlisten of unlisteners) unlisten();
		unlisteners.length = 0;
	}

	return {
		async connect(credentials: VoiceCredentials, options: { microphone: boolean }) {
			await subscribe();
			const connected = await invoke<Connected>('voice_connect', { credentials, options });
			generation = connected.generation;
			handlers.onEncryption(connected.encrypted);
			for (const identity of connected.participants) {
				applyVolume(identity, handlers.volumeFor(identity));
			}
		},

		async disconnect() {
			closed = true;
			unsubscribe();
			await invoke('voice_disconnect');
		},

		async setMicrophoneEnabled(enabled: boolean) {
			await invoke('voice_set_microphone', { enabled }).catch(() => {});
		},

		setDeafened(deafened: boolean) {
			void invoke('voice_set_deafened', { deafened }).catch(() => {});
		},

		setParticipantVolume(userId: string, volume: number) {
			applyVolume(userId, volume);
		},

		async rotateKey(next: EncryptionKey) {
			await invoke('voice_rotate_key', { next }).catch(() => {});
		}
	};
}
