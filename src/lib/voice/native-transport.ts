import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
	DisconnectCause,
	EncryptionKey,
	VoiceCredentials,
	VoiceTransport,
	VoiceTransportHandlers
} from './transport';

const stateEvent = 'voice://state';
const participantEvent = 'voice://participant';

interface StateEvent {
	generation: number;
	kind: 'connected' | 'reconnecting' | 'disconnected';
	cause?: DisconnectCause;
}

interface ParticipantEvent {
	generation: number;
	identity: string;
	kind: 'subscribed' | 'unsubscribed';
}

interface Connected {
	generation: number;
	encrypted: boolean;
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

	async function subscribe() {
		unlisteners.push(
			await listen<StateEvent>(stateEvent, ({ payload }) => {
				if (!mine(payload)) return;
				if (payload.kind === 'disconnected') {
					handlers.onState({ kind: 'disconnected', cause: payload.cause ?? 'network' });
				} else {
					handlers.onState({ kind: payload.kind });
				}
			}),
			await listen<ParticipantEvent>(participantEvent, ({ payload }) => {
				if (!mine(payload) || payload.kind !== 'subscribed') return;
				applyVolume(payload.identity, handlers.volumeFor(payload.identity));
			})
		);
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
			await invoke('voice_rotate_key', { next });
		}
	};
}
