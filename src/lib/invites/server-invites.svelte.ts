import { loadServerInvites, revokeInvite, type ServerInvite } from './invites';

export function createServerInvites(serverId: string) {
	let invites = $state<ServerInvite[] | null>(null);
	let error = $state<string | null>(null);
	let loading = false;

	async function load() {
		if (loading) return;
		loading = true;
		const result = await loadServerInvites(serverId);
		loading = false;
		if (result.ok) {
			invites = result.invites;
			error = null;
		} else {
			error = result.message;
		}
	}

	async function revoke(code: string): Promise<string | null> {
		const result = await revokeInvite(serverId, code);
		if (!result.ok) return result.message;
		invites = (invites ?? []).filter((invite) => invite.code !== code);
		return null;
	}

	return {
		get invites() {
			return invites;
		},
		get error() {
			return error;
		},
		load,
		revoke
	};
}

export type ServerInvites = ReturnType<typeof createServerInvites>;
