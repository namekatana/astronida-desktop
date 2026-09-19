import { audioContext } from './sounds';

const pollIntervalMs = 40;
const speakingThreshold = 0.015;
const releaseMs = 180;
const fftSize = 512;

interface Meter {
	source: MediaStreamAudioSourceNode;
	analyser: AnalyserNode;
	samples: Float32Array<ArrayBuffer>;
	quietSince: number | null;
	speaking: boolean;
}

export interface SpeakingDetector {
	add(userId: string, track: MediaStreamTrack): void;
	remove(userId: string): void;
	dispose(): void;
}

function rms(samples: Float32Array): number {
	let sum = 0;
	for (const sample of samples) sum += sample * sample;
	return Math.sqrt(sum / samples.length);
}

export function createSpeakingDetector(onChange: (userIds: string[]) => void): SpeakingDetector {
	const meters = new Map<string, Meter>();
	let timer: ReturnType<typeof setInterval> | null = null;
	let lastEmitted = '';

	function emit() {
		const speaking = [...meters.entries()]
			.filter(([, meter]) => meter.speaking)
			.map(([userId]) => userId);
		const key = speaking.join(',');
		if (key === lastEmitted) return;
		lastEmitted = key;
		onChange(speaking);
	}

	function poll() {
		const now = performance.now();
		for (const meter of meters.values()) {
			meter.analyser.getFloatTimeDomainData(meter.samples);
			const loud = rms(meter.samples) >= speakingThreshold;
			if (loud) {
				meter.quietSince = null;
				meter.speaking = true;
			} else if (meter.speaking) {
				meter.quietSince ??= now;
				if (now - meter.quietSince >= releaseMs) meter.speaking = false;
			}
		}
		emit();
	}

	function ensurePolling() {
		if (timer || meters.size === 0) return;
		timer = setInterval(poll, pollIntervalMs);
	}

	function stopPollingIfIdle() {
		if (!timer || meters.size > 0) return;
		clearInterval(timer);
		timer = null;
	}

	return {
		add(userId, track) {
			this.remove(userId);
			const ctx = audioContext();
			const source = ctx.createMediaStreamSource(new MediaStream([track]));
			const analyser = ctx.createAnalyser();
			analyser.fftSize = fftSize;
			source.connect(analyser);
			meters.set(userId, {
				source,
				analyser,
				samples: new Float32Array(analyser.fftSize),
				quietSince: null,
				speaking: false
			});
			ensurePolling();
		},

		remove(userId) {
			const meter = meters.get(userId);
			if (!meter) return;
			meter.source.disconnect();
			meters.delete(userId);
			emit();
			stopPollingIfIdle();
		},

		dispose() {
			for (const userId of [...meters.keys()]) this.remove(userId);
		}
	};
}
