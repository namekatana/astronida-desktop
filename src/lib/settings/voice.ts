export type InputMode = 'voiceActivity' | 'pushToTalk';
export type AudioProcessingId = 'noiseSuppression' | 'echoCancellation';
export type DeviceKind = 'audioinput' | 'audiooutput' | 'videoinput';

export interface DeviceOption {
	value: string;
	label: string;
}

export interface VoiceVideoPreferences {
	microphone: string;
	speaker: string;
	camera: string;
	inputVolume: number;
	outputVolume: number;
	inputMode: InputMode;
	pushToTalkKey: string | null;
	processing: Record<AudioProcessingId, boolean>;
}

export const inputModes: { value: InputMode; label: string }[] = [
	{ value: 'voiceActivity', label: 'Голосовая активность' },
	{ value: 'pushToTalk', label: 'Нажать и говорить' }
];

export const processingOptions: { id: AudioProcessingId; label: string; description: string }[] = [
	{ id: 'noiseSuppression', label: 'Шумоподавление', description: 'Убирает фоновый шум' },
	{ id: 'echoCancellation', label: 'Эхоподавление', description: 'Убирает звук из динамиков' }
];

export const defaultDeviceId = 'default';
export const maxVolume = 200;

export function defaultVoiceVideoPreferences(): VoiceVideoPreferences {
	return {
		microphone: defaultDeviceId,
		speaker: defaultDeviceId,
		camera: defaultDeviceId,
		inputVolume: 100,
		outputVolume: 100,
		inputMode: 'voiceActivity',
		pushToTalkKey: null,
		processing: { noiseSuppression: true, echoCancellation: true }
	};
}

const modifierLabels: Record<string, string> = {
	Control: 'Ctrl',
	Alt: 'Alt',
	Shift: 'Shift',
	Meta: 'Win'
};

const keyLabels: Record<string, string> = {
	Space: 'Пробел',
	Backquote: '`',
	CapsLock: 'Caps Lock',
	Tab: 'Tab',
	Enter: 'Enter',
	Backspace: 'Backspace',
	ArrowUp: '↑',
	ArrowDown: '↓',
	ArrowLeft: '←',
	ArrowRight: '→'
};

function keyName(code: string, key: string): string {
	if (code.startsWith('Key')) return code.slice(3);
	if (code.startsWith('Digit')) return code.slice(5);
	if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
	return keyLabels[code] ?? (key.length === 1 ? key.toUpperCase() : key);
}

export function shortcutLabel(event: KeyboardEvent): string {
	const modifier = modifierLabels[event.key];
	if (modifier) return modifier;
	const parts: string[] = [];
	if (event.ctrlKey) parts.push('Ctrl');
	if (event.altKey) parts.push('Alt');
	if (event.shiftKey) parts.push('Shift');
	if (event.metaKey) parts.push('Win');
	parts.push(keyName(event.code, event.key));
	return parts.join(' + ');
}

const systemDeviceIds = new Set([defaultDeviceId, 'communications', '']);

const fallbackNames: Record<DeviceKind, string> = {
	audioinput: 'Микрофон',
	audiooutput: 'Динамики',
	videoinput: 'Камера'
};

export function defaultDeviceOptions(): Record<DeviceKind, DeviceOption[]> {
	const byDefault = { value: defaultDeviceId, label: 'По умолчанию' };
	return { audioinput: [byDefault], audiooutput: [byDefault], videoinput: [byDefault] };
}

export async function listDevices(): Promise<Record<DeviceKind, DeviceOption[]>> {
	const options = defaultDeviceOptions();
	let devices: MediaDeviceInfo[] = [];
	try {
		devices = await navigator.mediaDevices.enumerateDevices();
	} catch {
		return options;
	}
	for (const device of devices) {
		if (systemDeviceIds.has(device.deviceId)) continue;
		const list = options[device.kind];
		list.push({
			value: device.deviceId,
			label: device.label || `${fallbackNames[device.kind]} ${list.length}`
		});
	}
	return options;
}
