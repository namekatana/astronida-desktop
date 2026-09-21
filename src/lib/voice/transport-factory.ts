import { PUBLIC_VOICE_TRANSPORT } from '$env/static/public';
import { createLiveKitTransport, warmUp } from './livekit-transport';
import { createNativeTransport } from './native-transport';
import type { VoiceTransport, VoiceTransportHandlers } from './transport';

function isTauri() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function nativeTransportEnabled() {
	return PUBLIC_VOICE_TRANSPORT === 'native' && isTauri();
}

export function createVoiceTransport(handlers: VoiceTransportHandlers): VoiceTransport {
	return nativeTransportEnabled() ? createNativeTransport(handlers) : createLiveKitTransport(handlers);
}

export function prepareTransport(url: string) {
	if (!nativeTransportEnabled()) warmUp(url);
}
