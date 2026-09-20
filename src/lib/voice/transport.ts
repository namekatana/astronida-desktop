export interface EncryptionKey {
	key: string;
	version: number;
}

export interface VoiceCredentials {
	url: string;
	token: string;
	e2ee: EncryptionKey;
}

export type VoiceQuality = 'excellent' | 'good' | 'poor' | 'lost';

export interface VoiceStats {
	rttMs: number | null;
	lossPercent: number | null;
}

export type DisconnectCause = 'network' | 'duplicate' | 'removed' | 'client';

export type TransportState =
	| { kind: 'connected' }
	| { kind: 'reconnecting' }
	| { kind: 'disconnected'; cause: DisconnectCause };

export interface VoiceTransportHandlers {
	onState: (state: TransportState) => void;
	onQuality: (quality: VoiceQuality) => void;
	onParticipantQuality: (userId: string, quality: VoiceQuality | null) => void;
	onParticipantStats: (userId: string, stats: VoiceStats | null) => void;
	onEncryption: (encrypted: boolean) => void;
	onStats: (stats: VoiceStats) => void;
	onSpeaking: (userIds: string[]) => void;
	volumeFor: (userId: string) => number;
}

export interface VoiceTransport {
	connect(credentials: VoiceCredentials, options: { microphone: boolean }): Promise<void>;
	disconnect(): Promise<void>;
	setMicrophoneEnabled(enabled: boolean): Promise<void>;
	setDeafened(deafened: boolean): void;
	setParticipantVolume(userId: string, volume: number): void;
	rotateKey(next: EncryptionKey): Promise<void>;
}
