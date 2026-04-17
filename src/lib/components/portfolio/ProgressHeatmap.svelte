<script lang="ts">
	let {
		data = [],
		streak = 0
	}: {
		data?: Array<{ date: string; rate: number; day: number }>;
		streak?: number;
	} = $props();

	const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

	// Group data into weeks (columns)
	const weeks = $derived.by(() => {
		if (!data || data.length === 0) return [];
		const result: Array<Array<{ date: string; rate: number; day: number } | null>> = [];
		let currentWeek: Array<{ date: string; rate: number; day: number } | null> = [];

		// Pad the start with nulls for alignment
		if (data.length > 0) {
			const firstDay = data[0].day;
			for (let i = 0; i < firstDay; i++) {
				currentWeek.push(null);
			}
		}

		for (const d of data) {
			currentWeek.push(d);
			if (d.day === 6) { // Saturday = end of week
				result.push(currentWeek);
				currentWeek = [];
			}
		}
		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) currentWeek.push(null);
			result.push(currentWeek);
		}

		return result;
	});

	function cellColor(rate: number) {
		if (rate <= 0) return 'bg-dark-border/30';
		if (rate < 25) return 'bg-brand-primary/15';
		if (rate < 50) return 'bg-brand-primary/30';
		if (rate < 75) return 'bg-brand-primary/50';
		return 'bg-brand-primary/80';
	}

	// Month labels
	const monthLabels = $derived.by(() => {
		if (!data || data.length === 0) return [];
		const labels: Array<{ text: string; weekIndex: number }> = [];
		const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
		let lastMonth = -1;
		let dayIndex = 0;

		for (let wi = 0; wi < weeks.length; wi++) {
			for (const cell of weeks[wi]) {
				if (cell) {
					const month = new Date(cell.date + 'T00:00:00').getMonth();
					if (month !== lastMonth) {
						labels.push({ text: months[month], weekIndex: wi });
						lastMonth = month;
					}
					dayIndex++;
				}
			}
		}
		return labels;
	});
</script>

<div class="heatmap-wrap space-y-4" style="--weeks: {weeks.length}">
	<div class="flex items-center justify-between">
		<h3 class="text-base font-semibold text-gray-300">ติดตามวินัย</h3>
		{#if streak > 0}
			<div class="flex items-center gap-1.5 text-sm">
				<span class="text-brand-primary font-bold text-base">{streak}</span>
				<span class="text-gray-400">วันติดต่อกัน</span>
			</div>
		{/if}
	</div>

	<!-- Heatmap grid -->
	<div class="heatmap-grid">
		<!-- Month labels row (spans the week columns) -->
		{#if monthLabels.length > 0}
			<div class="heatmap-months">
				{#each weeks as _, wi}
					{@const label = monthLabels.find(m => m.weekIndex === wi)}
					<div class="text-[11px] text-gray-400 text-center truncate">{label ? label.text : ''}</div>
				{/each}
			</div>
		{:else}
			<div></div>
		{/if}

		<!-- Day labels column -->
		<div class="heatmap-days">
			{#each dayLabels as label, i}
				<div class="text-[11px] text-gray-400 text-right pr-2 flex items-center justify-end">
					{i % 2 === 1 ? label : ''}
				</div>
			{/each}
		</div>

		<!-- Cells -->
		<div class="heatmap-cells">
			{#each weeks as week}
				<div class="heatmap-col">
					{#each week as cell}
						{#if cell}
							<div
								class="heatmap-cell rounded {cellColor(cell.rate)}"
								title="{cell.date}: สำเร็จ {cell.rate.toFixed(0)}%"
							></div>
						{:else}
							<div class="heatmap-cell"></div>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="flex items-center gap-2 text-[12px] text-gray-400">
		<span>น้อย</span>
		<div class="w-[14px] h-[14px] rounded bg-dark-border/30"></div>
		<div class="w-[14px] h-[14px] rounded bg-brand-primary/15"></div>
		<div class="w-[14px] h-[14px] rounded bg-brand-primary/30"></div>
		<div class="w-[14px] h-[14px] rounded bg-brand-primary/50"></div>
		<div class="w-[14px] h-[14px] rounded bg-brand-primary/80"></div>
		<span>มาก</span>
	</div>
</div>

<style>
	.heatmap-wrap {
		width: 100%;
	}

	.heatmap-grid {
		display: grid;
		grid-template-columns: 2rem 1fr;
		grid-template-rows: auto auto;
		gap: 0.25rem 0.5rem;
		align-items: stretch;
	}

	.heatmap-months {
		grid-column: 2;
		grid-row: 1;
		display: grid;
		grid-template-columns: repeat(var(--weeks), 1fr);
		gap: 3px;
	}

	.heatmap-days {
		grid-column: 1;
		grid-row: 2;
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		gap: 3px;
	}

	.heatmap-cells {
		grid-column: 2;
		grid-row: 2;
		display: grid;
		grid-template-columns: repeat(var(--weeks), 1fr);
		gap: 3px;
		min-width: 0;
	}

	.heatmap-col {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		gap: 3px;
	}

	.heatmap-cell {
		width: 100%;
		aspect-ratio: 1 / 1;
	}
</style>
