<script lang="ts">
	import { version } from '../../../package.json';
</script>

<section aria-labelledby="sessions-current">
	<h4 id="sessions-current" class="px-1 pb-2 text-[13px] font-semibold text-muted">Этот сеанс</h4>
	<div class="overflow-hidden rounded-[14px] bg-white/[0.05] [corner-shape:squircle]">
		<div class="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
			<div class="min-w-0 flex-1">
				<p class="truncate text-[14px] leading-5 text-ink">Astronida для Windows</p>
				<p class="mt-0.5 truncate text-[12px] leading-4 text-muted">
					Версия {version} · <span class="text-online">в сети</span>
				</p>
			</div>
		</div>
		<div class="ml-4 h-px bg-white/[0.06]"></div>
		<button
			type="button"
			class="flex h-11 w-full items-center px-4 text-left text-[14px] text-danger transition-colors duration-150 hover:bg-white/[0.03]"
		>
			Завершить другие сеансы
		</button>
	</div>
	<p class="px-1 pt-2 text-[12px] leading-4 text-muted">
		Вы выйдете на всех устройствах, кроме этого
	</p>
</section>
