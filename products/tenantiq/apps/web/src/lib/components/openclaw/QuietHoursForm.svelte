<script lang="ts">
	interface Props {
		quietHoursStart: string;
		quietHoursEnd: string;
		onStartChange: (val: string) => void;
		onEndChange: (val: string) => void;
	}

	let { quietHoursStart, quietHoursEnd, onStartChange, onEndChange }: Props = $props();
</script>

<section class="space-y-4">
	<h3 class="text-sm font-semibold text-[var(--color-text)]">Quiet Hours</h3>
	<p class="text-xs text-[var(--color-text-secondary)]">Don't send notifications during these hours</p>
	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-1.5">
			<label for="quiet-start" class="block text-sm font-medium text-[var(--color-text)]">Start Time</label>
			<input
				id="quiet-start"
				type="time"
				value={quietHoursStart}
				oninput={(e) => onStartChange((e.target as HTMLInputElement).value)}
				class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none"
			/>
		</div>
		<div class="space-y-1.5">
			<label for="quiet-end" class="block text-sm font-medium text-[var(--color-text)]">End Time</label>
			<input
				id="quiet-end"
				type="time"
				value={quietHoursEnd}
				oninput={(e) => onEndChange((e.target as HTMLInputElement).value)}
				class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none"
			/>
		</div>
	</div>
</section>
