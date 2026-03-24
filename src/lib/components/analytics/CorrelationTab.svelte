<script lang="ts">
	let { correlationMatrix } = $props<{
		correlationMatrix: {
			symbols: string[];
			matrix: (number | null)[][];
			topPairs: Array<{ symA: string; symB: string; correlation: number; sharedDays: number }>;
		} | null | undefined;
	}>();

	let hoveredCell = $state<{ i: number; j: number } | null>(null);

	function corrCellBg(val: number | null, isDiag: boolean): string {
		if (isDiag) return 'bg-dark-border/40';
		if (val === null) return 'bg-dark-bg/30';
		const abs = Math.abs(val);
		if (val >= 0) {
			if (abs >= 0.7) return 'bg-red-500/70';
			if (abs >= 0.4) return 'bg-amber-500/50';
			if (abs >= 0.2) return 'bg-amber-500/20';
			return 'bg-dark-bg/30';
		} else {
			if (abs >= 0.7) return 'bg-blue-500/60';
			if (abs >= 0.4) return 'bg-blue-500/35';
			if (abs >= 0.2) return 'bg-blue-500/15';
			return 'bg-dark-bg/30';
		}
	}

	function corrCellText(val: number | null, isDiag: boolean): string {
		if (isDiag) return 'text-gray-400';
		if (val === null) return 'text-gray-400';
		const abs = Math.abs(val);
		if (abs >= 0.4) return 'text-white font-semibold';
		if (abs >= 0.2) return 'text-gray-300';
		return 'text-gray-400';
	}

	function corrLabel(val: number): string {
		const abs = Math.abs(val);
		if (abs >= 0.7) return val >= 0 ? 'สัมพันธ์สูง (+)' : 'สัมพันธ์ตรงข้าม (-)';
		if (abs >= 0.4) return val >= 0 ? 'สัมพันธ์ปานกลาง (+)' : 'สัมพันธ์ตรงข้ามปานกลาง';
		if (abs >= 0.2) return 'สัมพันธ์เล็กน้อย';
		return 'ไม่มีความสัมพันธ์';
	}
</script>

<!-- CORRELATION MATRIX -->
<div class="space-y-6">
	{#if !correlationMatrix || correlationMatrix.symbols.length < 2}
		<div class="card">
			<div class="py-12 text-center">
				<div class="w-12 h-12 rounded-full bg-dark-bg flex items-center justify-center mx-auto mb-3">
					<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
				</div>
				<p class="text-gray-400 text-sm">ต้องการเทรดอย่างน้อย 2 สัญลักษณ์เพื่อคำนวณความสัมพันธ์</p>
				<p class="text-gray-400 text-xs mt-1">ขยายช่วงวันที่หรือปรับตัวกรองเพื่อดูข้อมูลเพิ่มเติม</p>
			</div>
		</div>
	{:else}
		<!-- Info banner -->
		<div class="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 flex gap-3 items-start">
			<svg class="w-4 h-4 text-brand-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
			<p class="text-xs text-gray-400 leading-relaxed">
				<span class="text-white font-medium">ความสัมพันธ์ของ P&L รายวัน</span> — วัดว่าคู่สกุลเงินมีแนวโน้มขึ้นและลงพร้อมกันมากแค่ไหน
				ค่าใกล้ <span class="text-red-400">+1</span> = เคลื่อนไหวเหมือนกัน (ความเสี่ยงสูง), ค่าใกล้ <span class="text-blue-400">-1</span> = เคลื่อนไหวตรงข้าม (กระจายความเสี่ยง), ค่าใกล้ <span class="text-gray-400">0</span> = ไม่สัมพันธ์กัน
			</p>
		</div>

		<!-- Heatmap grid -->
		<div class="card overflow-x-auto">
			<h3 class="text-sm font-semibold text-white mb-5">เมทริกซ์ความสัมพันธ์ (Pearson r)</h3>
			<div class="min-w-max">
				<div class="flex">
					<!-- Top-left corner spacer -->
					<div class="w-20 shrink-0"></div>
					<!-- Column headers -->
					{#each correlationMatrix.symbols as sym}
						<div class="w-16 h-10 flex items-end justify-center pb-1">
							<span class="text-[10px] text-gray-400 font-medium rotate-[-35deg] origin-bottom-left whitespace-nowrap">{sym}</span>
						</div>
					{/each}
				</div>
				{#each correlationMatrix.symbols as symRow, i}
					<div class="flex items-center">
						<!-- Row label -->
						<div class="w-20 shrink-0 pr-2 text-right">
							<span class="text-xs text-gray-400 font-medium">{symRow}</span>
						</div>
						<!-- Cells -->
						{#each correlationMatrix.symbols as symCol, j}
							{@const val = correlationMatrix.matrix[i]?.[j] ?? null}
							{@const isDiag = i === j}
							{@const isHovered = hoveredCell?.i === i && hoveredCell?.j === j}
							<div
								class="w-16 h-12 flex items-center justify-center rounded-md m-0.5 cursor-default transition-all duration-150 relative
									{corrCellBg(val, isDiag)}
									{isHovered && !isDiag ? 'ring-1 ring-white/30 scale-105 z-10' : ''}"
								onmouseenter={() => { if (!isDiag) hoveredCell = { i, j }; }}
								onmouseleave={() => { hoveredCell = null; }}
								role="cell"
								tabindex="-1"
								aria-label="{isDiag ? symRow : `${symRow} vs ${symCol}: ${val !== null ? val.toFixed(2) : 'N/A'}`}"
							>
								{#if isDiag}
									<span class="text-xs text-gray-400">—</span>
								{:else if val === null}
									<span class="text-[10px] text-gray-400">N/A</span>
								{:else}
									<span class="text-xs {corrCellText(val, isDiag)}">{val.toFixed(2)}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</div>

			<!-- Hover tooltip -->
			{#if hoveredCell && correlationMatrix.symbols[hoveredCell.i] && correlationMatrix.symbols[hoveredCell.j]}
				{@const hv = correlationMatrix.matrix[hoveredCell.i]?.[hoveredCell.j] ?? null}
				<div class="mt-4 pt-4 border-t border-dark-border/40 flex items-center gap-3">
					<div class="flex-1 flex items-center gap-2 text-sm">
						<span class="font-medium text-white">{correlationMatrix.symbols[hoveredCell.i]}</span>
						<span class="text-gray-400">×</span>
						<span class="font-medium text-white">{correlationMatrix.symbols[hoveredCell.j]}</span>
					</div>
					{#if hv !== null}
						<div class="flex items-center gap-3">
							<span class="text-2xl font-bold {Math.abs(hv) >= 0.7 ? (hv >= 0 ? 'text-red-400' : 'text-blue-400') : Math.abs(hv) >= 0.4 ? 'text-amber-400' : 'text-gray-400'}">{hv.toFixed(3)}</span>
							<span class="text-xs text-gray-400 bg-dark-bg rounded-md px-2 py-1">{corrLabel(hv)}</span>
						</div>
					{:else}
						<span class="text-xs text-gray-400">ข้อมูลไม่เพียงพอ (ต้องการอย่างน้อย 3 วันร่วมกัน)</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Color legend -->
		<div class="card">
			<h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">คำอธิบายสี</h4>
			<div class="flex flex-wrap gap-3">
				<div class="flex items-center gap-2">
					<div class="w-8 h-5 rounded bg-red-500/70 shrink-0"></div>
					<span class="text-xs text-gray-400">r ≥ 0.7 สัมพันธ์สูง (เสี่ยงสูง)</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-8 h-5 rounded bg-amber-500/50 shrink-0"></div>
					<span class="text-xs text-gray-400">0.4 – 0.7 สัมพันธ์ปานกลาง</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-8 h-5 rounded bg-dark-bg/60 border border-dark-border/30 shrink-0"></div>
					<span class="text-xs text-gray-400">–0.4 – 0.4 ไม่มีความสัมพันธ์</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-8 h-5 rounded bg-blue-500/35 shrink-0"></div>
					<span class="text-xs text-gray-400">–0.7 – –0.4 สัมพันธ์ตรงข้ามปานกลาง</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-8 h-5 rounded bg-blue-500/60 shrink-0"></div>
					<span class="text-xs text-gray-400">r ≤ –0.7 กระจายความเสี่ยงดี</span>
				</div>
			</div>
		</div>

		<!-- Top correlated pairs -->
		{#if correlationMatrix.topPairs.length > 0}
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">คู่ที่มีความสัมพันธ์สูงสุด</h3>
				<div class="space-y-2">
					{#each correlationMatrix.topPairs as pair}
						{@const absR = Math.abs(pair.correlation)}
						{@const isPositive = pair.correlation >= 0}
						<div class="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-dark-bg/40 hover:bg-dark-bg/70 transition-colors">
							<div class="flex items-center gap-1.5 min-w-[140px]">
								<span class="text-sm font-medium text-white">{pair.symA}</span>
								<span class="text-gray-400 text-xs">↔</span>
								<span class="text-sm font-medium text-white">{pair.symB}</span>
							</div>
							<!-- Bar -->
							<div class="flex-1 h-2 bg-dark-border/40 rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all {absR >= 0.7 ? (isPositive ? 'bg-red-500' : 'bg-blue-500') : absR >= 0.4 ? (isPositive ? 'bg-amber-500' : 'bg-blue-400') : 'bg-gray-600'}"
									style="width: {absR * 100}%"
								></div>
							</div>
							<div class="flex items-center gap-2 min-w-[100px] justify-end">
								<span class="text-sm font-bold {absR >= 0.7 ? (isPositive ? 'text-red-400' : 'text-blue-400') : absR >= 0.4 ? 'text-amber-400' : 'text-gray-400'}">
									{pair.correlation >= 0 ? '+' : ''}{pair.correlation.toFixed(3)}
								</span>
								<span class="text-[10px] text-gray-400 whitespace-nowrap">{pair.sharedDays} วัน</span>
							</div>
							{#if absR >= 0.7 && isPositive}
								<div class="shrink-0 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/20 text-[10px] text-red-400 font-medium">
									เสี่ยงสูง
								</div>
							{:else if absR >= 0.7 && !isPositive}
								<div class="shrink-0 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/20 text-[10px] text-blue-400 font-medium">
									กระจายเสี่ยง
								</div>
							{/if}
						</div>
					{/each}
				</div>
				{#if correlationMatrix.topPairs.some((p: { correlation: number }) => Math.abs(p.correlation) >= 0.7 && p.correlation >= 0)}
					<div class="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 flex gap-2 items-start">
						<svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
						<p class="text-xs text-red-300">คำเตือน: มีคู่สกุลเงินที่มีความสัมพันธ์สูง หากเปิดทั้งสองพร้อมกัน ความเสี่ยงจะเพิ่มขึ้นเป็นสองเท่า</p>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
