import type { ChannelKind } from '$lib/channels/channels';

export type PreviewItem =
	| { key: string; type: 'heading'; label: string; fresh?: boolean }
	| { key: string; type: 'channel'; kind: ChannelKind; label: string; fresh?: boolean }
	| { key: string; type: 'note'; label: string };
