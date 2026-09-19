export type ToggleSound =
	| 'mic-on'
	| 'mic-off'
	| 'deafen-on'
	| 'deafen-off'
	| 'voice-connected'
	| 'voice-disconnected';

const toneDurationSeconds = 0.07;
const toneGapSeconds = 0.05;
const peakGain = 0.1;

const tones: Record<ToggleSound, number[]> = {
	'mic-on': [520, 780],
	'mic-off': [780, 520],
	'deafen-on': [390, 585],
	'deafen-off': [585, 390],
	'voice-connected': [440, 660, 880],
	'voice-disconnected': [880, 660, 440]
};

let context: AudioContext | null = null;

function audioContext(): AudioContext {
	context ??= new AudioContext();
	if (context.state === 'suspended') void context.resume();
	return context;
}

function playTone(ctx: AudioContext, frequency: number, startAt: number) {
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = 'sine';
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(0.0001, startAt);
	gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + toneDurationSeconds);
	oscillator.connect(gain).connect(ctx.destination);
	oscillator.start(startAt);
	oscillator.stop(startAt + toneDurationSeconds);
}

export function playToggleSound(kind: ToggleSound) {
	const ctx = audioContext();
	const now = ctx.currentTime;
	tones[kind].forEach((frequency, index) => {
		playTone(ctx, frequency, now + index * (toneDurationSeconds + toneGapSeconds));
	});
}
