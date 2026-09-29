<script lang="ts">
	import type { Member } from '$lib/servers/members';
	import { initials } from '$lib/ui/initials';

	interface Props {
		friend: Member;
	}

	let { friend }: Props = $props();
</script>

<aside class="panel flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="scrollbar-none min-h-0 flex-1 overflow-y-auto">
		<div class="h-24 bg-white/[0.06]"></div>

		<div class="px-5 pb-5">
			<span class="relative -mt-10 block w-fit">
				<span
					class="flex h-20 w-20 items-center justify-center rounded-full bg-[#38383c] text-[26px] font-medium text-ink ring-[6px] ring-surface"
				>
					{initials(friend.name)}
				</span>
				<span
					class="absolute right-0.5 bottom-0.5 h-5 w-5 rounded-full border-4 border-surface bg-online transition-[opacity,scale] duration-200 ease-soft {friend.online
						? 'scale-100 opacity-100'
						: 'scale-50 opacity-0'}"
				></span>
			</span>

			<h2 class="mt-3 truncate text-[20px] leading-6 font-bold tracking-[-0.01em] text-ink">
				@{friend.username}
			</h2>

			<div class="mt-4 h-px bg-surface-line"></div>

			<section class="mt-3">
				<h3 class="text-[13px] font-semibold text-muted">О себе</h3>
				<p class="mt-1 text-[13px] text-muted">Описание пусто</p>
			</section>
		</div>
	</div>
</aside>
