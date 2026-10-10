export interface ModerationTarget {
	id: string;
	username: string;
	name: string;
	avatarId: string | null;
}

export interface MemberMenuRequest {
	target: ModerationTarget;
	serverId: string;
	x: number;
	y: number;
	source: HTMLElement | null;
}

export interface MemberModeration {
	allowed: (userId: string) => boolean;
	onkick: (target: ModerationTarget) => void;
	onban: (target: ModerationTarget) => void;
}

export function canModerate(input: {
	selfId: string;
	ownerId: string | null | undefined;
	targetId: string;
}): boolean {
	return input.ownerId === input.selfId && input.targetId !== input.selfId;
}
