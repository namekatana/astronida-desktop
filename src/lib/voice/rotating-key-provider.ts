import { BaseKeyProvider, createKeyMaterialFromBuffer, KeyProviderEvent } from 'livekit-client';

const keyringSize = 16;

export function keyIndexFor(version: number): number {
	return version % keyringSize;
}

export class RotatingKeyProvider extends BaseKeyProvider {
	constructor() {
		super({ sharedKey: true, ratchetWindowSize: 0, failureTolerance: -1, keySize: 128, keyringSize });
	}

	async install(key: ArrayBuffer, index: number) {
		const material = await createKeyMaterialFromBuffer(key);
		this.emit(KeyProviderEvent.SetKey, { key: material, keyIndex: index }, false);
	}

	async activate(key: ArrayBuffer, index: number) {
		const material = await createKeyMaterialFromBuffer(key);
		this.onSetEncryptionKey(material, undefined, index);
	}
}
