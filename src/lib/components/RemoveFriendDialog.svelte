<script lang="ts">
	import { removeFriend } from '$lib/friends/channel';
	import type { ModerationTarget } from '$lib/servers/moderation-target';
	import ConfirmButtons from './ConfirmButtons.svelte';
	import Dialog from './Dialog.svelte';
	import ModerationTargetCard from './ModerationTargetCard.svelte';
	import SheetHeader from './SheetHeader.svelte';

	interface Props {
		target: ModerationTarget;
		ondone: () => void;
		onclose: () => void;
	}

	let { target, ondone, onclose }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function confirm() {
		busy = true;
		error = null;
		const result = await removeFriend(target.id);
		busy = false;
		if (result.ok) ondone();
		else error = result.message;
	}
</script>

<Dialog label="Удалить из друзей" wide flush pinTop locked={busy} {onclose}>
	<SheetHeader
		title="Удалить из друзей"
		subtitle={error ?? 'Переписка останется'}
		subtitleDanger={error !== null}
	/>

	<div class="px-4 pb-4">
		<ModerationTargetCard {target} />
		<div class="mt-3">
			<ConfirmButtons label="Удалить" {busy} onconfirm={confirm} oncancel={onclose} />
		</div>
	</div>
</Dialog>
