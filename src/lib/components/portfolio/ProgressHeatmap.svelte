<script lang="ts">
	let {
		data = [],
		streak = 0
	}: {
		data?: Array<{ date: string; rate: number; day: number }>;
		streak?: number;
	} = $props();

	const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Group data into weeks (columns)
	const weeks = $derived((() => {
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
	})());

	function cellColor(rate: number) {
		if (rate <= 0) return 'bg-dark-border/30';
		if (rate < 25) return 'bg-brand-primary/15';
		if (rate < 50) return 'bg-brand-primary/30';
		if (rate < 75) return 'bg-brand-primary/50';
		return 'bg-brand-primary/80';
	}

	// Month labels
	const monthLabels = $derived((() => {
		if (!data || data.length === 0) return [];
		const labels: Array<{ text: string; weekIndex: number }> = [];
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
	})());
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-gray-400">Discipline Tracker</h3>
		{#if streak > 0}
			<div class="flex items-center gap-1.5 text-sm">
				<span class="text-brand-primary font-bold">{streak}</span>
				<span class="text-gray-500">day streak</span>
			</div>
		{/if}
	</div>

	<!-- Month labels -->
	{#if monthLabels.length > 0}
		<div class="flex gap-[3px] ml-8 text-[9px] text-gray-600">
			{#each weeks as _, wi}
				{@const label = monthLabels.find(m => m.weekIndex === wi)}
				<div class="w-[12px] text-center">{label ? label.text : ''}</div>
			{/each}
		</div>
	{/if}

	<!-- Heatmap grid -->
	<div class="flex gap-1">
		<!-- Day labels -->
		<div class="flex flex-col gap-[3px]">
			{#each dayLabels as label, i}
				<div class="h-[12px] text-[9px] text-gray-600 leading-[12px] w-6 text-right pr-1">
					{i % 2 === 1 ? label : ''}
				</div>
			{/each}
		</div>

		<!-- Cells -->
		<div class="flex gap-[3px] overflow-x-auto">
			{#each weeks as week}
				<div class="flex flex-col gap-[3px]">
					{#each week as cell}
						{#if cell}
							<div
								class="w-[12px] h-[12px] rounded-sm {cellColor(cell.rate)}"
								title="{cell.date}: {cell.rate.toFixed(0)}% complete"
							></div>
						{:else}
							<div class="w-[12px] h-[12px]"></div>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="flex items-center gap-2 text-[10px] text-gray-600">
		<span>Less</span>
		<div class="w-[10px] h-[10px] rounded-sm bg-dark-border/30"></div>
		<div class="w-[10px] h-[10px] rounded-sm bg-brand-primary/15"></div>
		<div class="w-[10px] h-[10px] rounded-sm bg-brand-primary/30"></div>
		<div class="w-[10px] h-[10px] rounded-sm bg-brand-primary/50"></div>
		<div class="w-[10px] h-[10px] rounded-sm bg-brand-primary/80"></div>
		<span>More</span>
	</div>
</div>
