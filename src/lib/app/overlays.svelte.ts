import type { ChannelKind } from '$lib/channels/channels';
import type { MemberMenuRequest, ModerationTarget } from '$lib/members/moderation-target';
import type { Message } from '$lib/messages/messages';
import type { ProfileTarget } from '$lib/profile/profile';
import type { AddServerView } from '$lib/servers/add-server';
import type { Server } from '$lib/servers/servers';

export type Overlay =
	| { kind: 'add-server'; view: AddServerView; value: string }
	| { kind: 'add-friend' }
	| { kind: 'invite' }
	| { kind: 'settings' }
	| { kind: 'create-channel'; channelKind: 'category' | ChannelKind }
	| { kind: 'photo-viewer'; message: Message; index: number; origin: DOMRect | null }
	| { kind: 'send-photos'; files: File[]; caption: string }
	| { kind: 'profile'; target: ProfileTarget; source: HTMLElement | null }
	| { kind: 'member-menu'; request: MemberMenuRequest }
	| {
			kind: 'moderation';
			action: 'kick' | 'ban';
			target: ModerationTarget;
			serverId: string;
			serverName: string;
	  }
	| { kind: 'server-settings'; server: Server }
	| { kind: 'unfriend'; target: ModerationTarget }
	| { kind: 'share-profile'; target: ProfileTarget };

export type OverlayKind = Overlay['kind'];

type OverlayOf<Kind extends OverlayKind> = Extract<Overlay, { kind: Kind }>;

export type Overlays = ReturnType<typeof createOverlays>;

export function createOverlays() {
	let layers = $state<Overlay[]>([]);

	function find<Kind extends OverlayKind>(kind: Kind): OverlayOf<Kind> | null {
		const layer = layers.find((candidate) => candidate.kind === kind);
		return (layer as OverlayOf<Kind> | undefined) ?? null;
	}

	function open(layer: Overlay) {
		layers = [...layers.filter((existing) => existing.kind !== layer.kind), layer];
	}

	function close(kind: OverlayKind) {
		layers = layers.filter((layer) => layer.kind !== kind);
	}

	return { find, open, close };
}
