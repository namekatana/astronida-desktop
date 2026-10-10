<script lang="ts">
	import type { ServerInvite } from '$lib/servers/invites';
	import ConfirmButtons from './ConfirmButtons.svelte';
	import Dialog from './Dialog.svelte';
	import InviteLinkSummary from './InviteLinkSummary.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		invite: ServerInvite;
		onconfirm: () => Promise<string | null>;
		onclose: () => void;
	}

	let { invite, onconfirm, onclose }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function confirm() {
		busy = true;
		error = null;
		const failure = await onconfirm();
		busy = false;
		if (failure === null) onclose();
		else error = failure;
	}
</script>

<Dialog label="Удалить ссылку" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Удалить ссылку"
		subtitle={error ?? 'Она сразу перестанет работать'}
		subtitleDanger={error !== null}
	/>

	<div class="px-4 pb-4">
		<div
			class="flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-3.5 py-2.5 [corner-shape:squircle]"
		>
			<InviteLinkSummary {invite} />
		</div>
		<div class="mt-3">
			<ConfirmButtons label="Удалить" {busy} onconfirm={confirm} oncancel={onclose} />
		</div>
	</div>
</Dialog>
