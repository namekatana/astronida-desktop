export interface VoiceCredentials {
	url: string;
	token: string;
}

export interface VoiceTransportHandlers {
	onPing: (ms: number | null) => void;
	onDisconnected: () => void;
}

export interface VoiceTransport {
	connect(credentials: VoiceCredentials): Promise<void>;
	disconnect(): Promise<void>;
	setMicrophoneEnabled(enabled: boolean): Promise<void>;
	setDeafened(deafened: boolean): void;
}
