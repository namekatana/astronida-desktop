import {
	ConnectionQuality,
	createLocalAudioTrack,
	DisconnectReason,
	ExternalE2EEKeyProvider,
	LocalAudioTrack,
	Room,
	RoomEvent,
	Track,
	type AudioCaptureOptions,
	type Participant,
	type RemoteTrack
} from 'livekit-client';
import E2EEWorker from 'livekit-client/e2ee-worker?worker';
import { createSpeakingDetector } from './speaking-detector';
import type {
	DisconnectCause,
	VoiceCredentials,
	VoiceQuality,
	VoiceStats,
	VoiceTransport,
	VoiceTransportHandlers
} from './transport';

const statsIntervalMs = 2000;
const microphoneBitrate = 64_000;
const warmUpTtlMs = 60_000;
const statsTopic = 'stats';
const statsMinGapMs = 500;
const maxRttMs = 10_000;
const e2eeKeyBytes = 32;

const captureDefaults: AudioCaptureOptions = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
	voiceIsolation: false
};

const statsEncoder = new TextEncoder();
const statsDecoder = new TextDecoder();

function encodeStats(stats: VoiceStats): Uint8Array<ArrayBuffer> {
	return statsEncoder.encode(JSON.stringify({ r: stats.rttMs, l: stats.lossPercent }));
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return Math.min(max, Math.max(min, value));
}

function decodeStats(payload: Uint8Array): VoiceStats | null {
	if (payload.byteLength > 64) return null;
	try {
		const parsed = JSON.parse(statsDecoder.decode(payload)) as { r?: unknown; l?: unknown };
		return {
			rttMs: boundedNumber(parsed.r, 0, maxRttMs),
			lossPercent: boundedNumber(parsed.l, 0, 100)
		};
	} catch {
		return null;
	}
}

function decodeKey(base64: string): ArrayBuffer | null {
	try {
		const binary = atob(base64);
		if (binary.length !== e2eeKeyBytes) return null;
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes.buffer;
	} catch {
		return null;
	}
}

interface RtcStat {
	type: string;
	state?: string;
	nominated?: boolean;
	currentRoundTripTime?: number;
	roundTripTime?: number;
	fractionLost?: number;
}

function statsFrom(report: RTCStatsReport | undefined): VoiceStats {
	if (!report) return { rttMs: null, lossPercent: null };
	let candidatePair: number | null = null;
	let remoteInbound: number | null = null;
	let fractionLost: number | null = null;
	report.forEach((raw) => {
		const stat = raw as RtcStat;
		if (stat.type === 'candidate-pair' && stat.nominated && stat.state === 'succeeded') {
			if (typeof stat.currentRoundTripTime === 'number') candidatePair = stat.currentRoundTripTime;
		}
		if (stat.type === 'remote-inbound-rtp') {
			if (typeof stat.roundTripTime === 'number') remoteInbound = stat.roundTripTime;
			if (typeof stat.fractionLost === 'number') fractionLost = stat.fractionLost;
		}
	});
	const seconds = candidatePair ?? remoteInbound;
	return {
		rttMs: seconds === null ? null : Math.round(seconds * 1000),
		lossPercent: fractionLost === null ? null : Math.round(fractionLost * 1000) / 10
	};
}

function qualityFrom(quality: ConnectionQuality): VoiceQuality | null {
	switch (quality) {
		case ConnectionQuality.Excellent:
			return 'excellent';
		case ConnectionQuality.Good:
			return 'good';
		case ConnectionQuality.Poor:
			return 'poor';
		case ConnectionQuality.Lost:
			return 'lost';
		default:
			return null;
	}
}

function causeFrom(reason: DisconnectReason | undefined): DisconnectCause {
	switch (reason) {
		case DisconnectReason.CLIENT_INITIATED:
			return 'client';
		case DisconnectReason.DUPLICATE_IDENTITY:
			return 'duplicate';
		case DisconnectReason.PARTICIPANT_REMOVED:
		case DisconnectReason.ROOM_DELETED:
		case DisconnectReason.ROOM_CLOSED:
		case DisconnectReason.USER_REJECTED:
			return 'removed';
		default:
			return 'network';
	}
}

const warmedUp = new Map<string, number>();

export function warmUp(url: string) {
	const last = warmedUp.get(url) ?? 0;
	if (Date.now() - last < warmUpTtlMs) return;
	warmedUp.set(url, Date.now());
	void new Room().prepareConnection(url);
}

export function createLiveKitTransport(handlers: VoiceTransportHandlers): VoiceTransport {
	const keyProvider = new ExternalE2EEKeyProvider({ keySize: 128 });
	const worker: Worker = new E2EEWorker();
	const room = new Room({
		adaptiveStream: true,
		audioCaptureDefaults: captureDefaults,
		publishDefaults: { audioPreset: { maxBitrate: microphoneBitrate }, red: true, dtx: false },
		encryption: { keyProvider, worker }
	});

	let deafened = false;
	let statsTimer: ReturnType<typeof setInterval> | null = null;
	const lastStatsAt = new Map<string, number>();
	const speaking = createSpeakingDetector(handlers.onSpeaking);

	function applyDeafen() {
		for (const participant of room.remoteParticipants.values()) {
			participant.setVolume(deafened ? 0 : 1);
		}
	}

	function microphoneTrack(): LocalAudioTrack | undefined {
		const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
		return track instanceof LocalAudioTrack ? track : undefined;
	}

	function meterLocalMicrophone() {
		const track = microphoneTrack();
		if (track) speaking.add(room.localParticipant.identity, track.mediaStreamTrack);
		else speaking.remove(room.localParticipant.identity);
	}

	function statsSource(): Track | undefined {
		const local = microphoneTrack();
		if (local) return local;
		for (const participant of room.remoteParticipants.values()) {
			const track = participant.getTrackPublication(Track.Source.Microphone)?.track;
			if (track) return track;
		}
		return undefined;
	}

	async function measureStats() {
		const report = await statsSource()?.getRTCStatsReport();
		const stats = statsFrom(report);
		handlers.onStats(stats);
		if (room.remoteParticipants.size === 0) return;
		try {
			await room.localParticipant.publishData(encodeStats(stats), {
				reliable: false,
				topic: statsTopic
			});
		} catch {
		}
	}

	function startStats() {
		stopStats();
		void measureStats();
		statsTimer = setInterval(() => void measureStats(), statsIntervalMs);
	}

	function stopStats() {
		if (statsTimer) clearInterval(statsTimer);
		statsTimer = null;
	}

	function acceptStats(identity: string): boolean {
		const now = performance.now();
		const last = lastStatsAt.get(identity) ?? 0;
		if (now - last < statsMinGapMs) return false;
		lastStatsAt.set(identity, now);
		return true;
	}

	async function acquireMicrophone(): Promise<LocalAudioTrack | null> {
		try {
			return await createLocalAudioTrack(captureDefaults);
		} catch {
			return null;
		}
	}

	function teardown() {
		stopStats();
		speaking.dispose();
		lastStatsAt.clear();
	}

	room
		.on(RoomEvent.ParticipantConnected, () => {
			applyDeafen();
			void measureStats();
		})
		.on(RoomEvent.Reconnecting, () => handlers.onState({ kind: 'reconnecting' }))
		.on(RoomEvent.Reconnected, () => {
			applyDeafen();
			meterLocalMicrophone();
			handlers.onState({ kind: 'connected' });
		})
		.on(RoomEvent.LocalTrackPublished, meterLocalMicrophone)
		.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant: Participant) => {
			const mapped = qualityFrom(quality);
			if (participant === room.localParticipant) {
				if (mapped) handlers.onQuality(mapped);
				return;
			}
			handlers.onParticipantQuality(participant.identity, mapped);
		})
		.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
			handlers.onParticipantQuality(participant.identity, null);
			handlers.onParticipantStats(participant.identity, null);
			lastStatsAt.delete(participant.identity);
		})
		.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
			if (topic !== statsTopic || !participant || !acceptStats(participant.identity)) return;
			handlers.onParticipantStats(participant.identity, decodeStats(payload));
		})
		.on(RoomEvent.ParticipantEncryptionStatusChanged, (encrypted: boolean, participant) => {
			if (participant === room.localParticipant) handlers.onEncryption(encrypted);
		})
		.on(RoomEvent.EncryptionError, () => handlers.onEncryption(false))
		.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication, participant) => {
			if (track.kind !== Track.Kind.Audio) return;
			document.body.appendChild(track.attach());
			speaking.add(participant.identity, track.mediaStreamTrack);
		})
		.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _publication, participant) => {
			for (const element of track.detach()) element.remove();
			speaking.remove(participant.identity);
		})
		.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
			teardown();
			handlers.onState({ kind: 'disconnected', cause: causeFrom(reason) });
		});

	return {
		async connect(credentials: VoiceCredentials, options: { microphone: boolean }) {
			const key = decodeKey(credentials.e2eeKey);
			if (!key) throw new Error('invalid_e2ee_key');
			await keyProvider.setKey(key);
			await room.setE2EEEnabled(true);

			const microphone = acquireMicrophone();
			try {
				await room.connect(credentials.url, credentials.token);
			} catch (error) {
				(await microphone)?.stop();
				throw error;
			}
			applyDeafen();
			handlers.onEncryption(room.isE2EEEnabled);
			const track = await microphone;
			if (track) {
				if (!options.microphone) await track.mute();
				await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
				meterLocalMicrophone();
			}
			startStats();
		},

		async disconnect() {
			teardown();
			await room.disconnect();
			worker.terminate();
		},

		async setMicrophoneEnabled(enabled: boolean) {
			await room.localParticipant.setMicrophoneEnabled(enabled);
			meterLocalMicrophone();
		},

		setDeafened(next: boolean) {
			deafened = next;
			applyDeafen();
		}
	};
}
