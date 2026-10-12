import { loadBans, unbanMember, type BannedMember } from './moderation';

export function createServerBans(serverId: string) {
	let bans = $state<BannedMember[] | null>(null);
	let error = $state<string | null>(null);
	let unbanning = $state<string | null>(null);
	let loading = false;

	async function load() {
		if (loading) return;
		loading = true;
		const result = await loadBans(serverId);
		loading = false;
		if (result.ok) {
			bans = result.bans;
			error = null;
		} else {
			error = result.message;
		}
	}

	async function unban(member: BannedMember) {
		if (unbanning) return;
		unbanning = member.id;
		error = null;
		const result = await unbanMember(serverId, member.id);
		unbanning = null;
		if (!result.ok) {
			error = result.message;
			return;
		}
		bans = (bans ?? []).filter((ban) => ban.id !== member.id);
	}

	return {
		get bans() {
			return bans;
		},
		get error() {
			return error;
		},
		get unbanning() {
			return unbanning;
		},
		load,
		unban
	};
}

export type ServerBans = ReturnType<typeof createServerBans>;
