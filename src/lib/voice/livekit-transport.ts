import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import type { VoiceCredentials, VoiceTransport, VoiceTransportHandlers } from './transport';

const pingIntervalMs = 2000;

interface RttStats {
	type: string;
	state?: string;
	nominated?: boolean;
	currentRoundTripTime?: number;
	roundTripTime?: number;
}

function roundTripFrom(report: RTCStatsReport | undefined): number | null {
	if (!report) return null;
	let candidatePair: number | null = null;
	let remoteInbound: number | null = null;
	report.forEach((raw) => {
		const stat = raw as RttStats;
		if (stat.type === 'candidate-pair' && stat.nominated && stat.state === 'succeeded') {
			if (typeof stat.currentRoundTripTime === 'number') candidatePair = stat.currentRoundTripTime;
		}
		if (stat.type === 'remote-inbound-rtp' && typeof stat.roundTripTime === 'number') {
			remoteInbound = stat.roundTripTime;
		}
	});
	const seconds = candidatePair ?? remoteInbound;
	return seconds === null ? null : Math.round(seconds * 1000);
}

export function createLiveKitTransport(handlers: VoiceTransportHandlers): VoiceTransport {
	const room = new Room({
		adaptiveStream: true,
		publishDefaults: { red: true, dtx: true }
	});

	let deafened = false;
	let pingTimer: ReturnType<typeof setInterval> | null = null;

	function applyDeafen() {
		for (const participant of room.remoteParticipants.values()) {
			participant.setVolume(deafened ? 0 : 1);
		}
	}

	async function measurePing() {
		const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
		const report = await publication?.track?.getRTCStatsReport();
		handlers.onPing(roundTripFrom(report));
	}

	function stopPing() {
		if (pingTimer) clearInterval(pingTimer);
		pingTimer = null;
	}

	room
		.on(RoomEvent.ParticipantConnected, applyDeafen)
		.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
			if (track.kind !== Track.Kind.Audio) return;
			document.body.appendChild(track.attach());
		})
		.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
			for (const element of track.detach()) element.remove();
		})
		.on(RoomEvent.Disconnected, () => {
			stopPing();
			handlers.onDisconnected();
		});

	return {
		async connect(credentials: VoiceCredentials) {
			await room.connect(credentials.url, credentials.token);
			applyDeafen();
			stopPing();
			pingTimer = setInterval(() => void measurePing(), pingIntervalMs);
		},

		async disconnect() {
			stopPing();
			await room.disconnect();
		},

		async setMicrophoneEnabled(enabled: boolean) {
			await room.localParticipant.setMicrophoneEnabled(enabled);
		},

		setDeafened(next: boolean) {
			deafened = next;
			applyDeafen();
		}
	};
}
