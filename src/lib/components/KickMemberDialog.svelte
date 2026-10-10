<script lang="ts">
	import { kickMember } from '$lib/servers/moderation';
	import type { ModerationTarget } from '$lib/servers/moderation-target';
	import ConfirmButtons from './ConfirmButtons.svelte';
	import Dialog from './Dialog.svelte';
	import ModerationTargetCard from './ModerationTargetCard.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		serverId: string;
		serverName: string;
		target: ModerationTarget;
		ondone: () => void;
		onclose: () => void;
	}

	let { serverId, serverName, target, ondone, onclose }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function confirm() {
		busy = true;
		error = null;
		const result = await kickMember(serverId, target.id);
		busy = false;
		if (result.ok) ondone();
		else error = result.message;
	}
</script>

<Dialog label="Удалить с сервера" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Удалить с сервера"
		subtitle={error ?? 'Сможет вернуться по приглашению'}
		subtitleDanger={error !== null}
	/>

	<div class="px-4 pb-4">
		<ModerationTargetCard {target} {serverName} />
		<div class="mt-3">
			<ConfirmButtons label="Удалить" {busy} onconfirm={confirm} oncancel={onclose} />
		</div>
	</div>
</Dialog>
