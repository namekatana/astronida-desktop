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

interface StateEvent {
	generation: number;
	kind: 'connected' | 'reconnecting' | 'disconnected';
	cause?: DisconnectCause;
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

	async function subscribe() {
		unlisteners.push(
			await listen<StateEvent>(stateEvent, ({ payload }) => {
				if (!mine(payload)) return;
				if (payload.kind === 'disconnected') {
					handlers.onState({ kind: 'disconnected', cause: payload.cause ?? 'network' });
				} else {
					handlers.onState({ kind: payload.kind });
				}
			})
		);
	}

	function unsubscribe() {
		for (const unlisten of unlisteners) unlisten();
		unlisteners.length = 0;
	}

	return {
		async connect(credentials: VoiceCredentials) {
			await subscribe();
			const connected = await invoke<Connected>('voice_connect', { credentials });
			generation = connected.generation;
			handlers.onEncryption(connected.encrypted);
		},

		async disconnect() {
			closed = true;
			unsubscribe();
			await invoke('voice_disconnect');
		},

		async setMicrophoneEnabled() {},

		setDeafened() {},

		setParticipantVolume() {},

		async rotateKey(next: EncryptionKey) {
			await invoke('voice_rotate_key', { next });
		}
	};
}
