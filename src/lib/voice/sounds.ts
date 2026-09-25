export type ToggleSound =
	| 'mic-on'
	| 'mic-off'
	| 'deafen-on'
	| 'deafen-off'
	| 'voice-connected'
	| 'voice-disconnected'
	| 'user-joined'
	| 'user-left'
	| 'direct-message'
	| 'friend-request';

const toneDurationSeconds = 0.07;
const toneGapSeconds = 0.05;
const peakGain = 0.1;
const softGain = 0.05;

const tones: Record<ToggleSound, { notes: number[]; gain: number }> = {
	'mic-on': { notes: [520, 780], gain: peakGain },
	'mic-off': { notes: [780, 520], gain: peakGain },
	'deafen-on': { notes: [390, 585], gain: peakGain },
	'deafen-off': { notes: [585, 390], gain: peakGain },
	'voice-connected': { notes: [440, 660, 880], gain: peakGain },
	'voice-disconnected': { notes: [880, 660, 440], gain: peakGain },
	'user-joined': { notes: [660, 880], gain: softGain },
	'user-left': { notes: [880, 660], gain: softGain },
	'direct-message': { notes: [784, 1047], gain: peakGain },
	'friend-request': { notes: [659, 784, 1047], gain: peakGain }
};

let context: AudioContext | null = null;

export function audioContext(): AudioContext {
	context ??= new AudioContext();
	if (context.state === 'suspended') void context.resume();
	return context;
}

function playTone(ctx: AudioContext, frequency: number, peak: number, startAt: number) {
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = 'sine';
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(0.0001, startAt);
	gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + toneDurationSeconds);
	oscillator.connect(gain).connect(ctx.destination);
	oscillator.start(startAt);
	oscillator.stop(startAt + toneDurationSeconds);
}

export function playToggleSound(kind: ToggleSound) {
	const ctx = audioContext();
	const now = ctx.currentTime;
	const { notes, gain } = tones[kind];
	notes.forEach((frequency, index) => {
		playTone(ctx, frequency, gain, now + index * (toneDurationSeconds + toneGapSeconds));
	});
}
