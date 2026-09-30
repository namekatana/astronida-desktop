import type { Channel } from 'phoenix';

export type PushOutcome<T> = { ok: true; reply: T } | { ok: false; reason: string };

export function pushTo<T>(channel: Channel, event: string, payload: object): Promise<PushOutcome<T>> {
	return new Promise((resolve) => {
		channel
			.push(event, payload)
			.receive('ok', (reply: T) => resolve({ ok: true, reply }))
			.receive('error', (reply: { reason?: string }) =>
				resolve({ ok: false, reason: reply?.reason ?? 'failed' })
			)
			.receive('timeout', () => resolve({ ok: false, reason: 'timeout' }));
	});
}
