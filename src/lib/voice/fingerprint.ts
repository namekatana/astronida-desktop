import type { VoiceKey } from '$lib/presence/presence';

const domain = 'astronida-voice-v1';
const digits = 30;
const groupSize = 5;
const digestBytesUsed = 16;

const encoder = new TextEncoder();

export async function keyFingerprint(channelId: string, key: VoiceKey): Promise<string> {
	const input = encoder.encode(`${domain}\n${channelId}\n${key.version}\n${key.key}`);
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
	let value = 0n;
	for (const byte of digest.subarray(0, digestBytesUsed)) value = (value << 8n) | BigInt(byte);
	const code = (value % 10n ** BigInt(digits)).toString().padStart(digits, '0');
	return code.match(new RegExp(`.{${groupSize}}`, 'g'))?.join(' ') ?? code;
}
