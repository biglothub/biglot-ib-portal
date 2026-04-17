<script lang="ts">
	import { formatPercent, formatNumber } from '$lib/utils';

	let { data }: {
		data: {
			probability: number;
			riskPerTradePct: number;
			zone: 'safe' | 'warning' | 'danger' | 'unknown';
			units: number;
			hasEnoughData: boolean;
		} | null;
	} = $props();

	const zoneColor = $derived(
		!data || data.zone === 'unknown' ? '#6b7280' :
		data.zone === 'safe' ? '#22c55e' :
		data.zone === 'warning' ? '#f59e0b' :
		'#ef4444'
	);

	const zoneLabel = $derived(
		!data || data.zone === 'unknown' ? '—' :
		data.zone === 'safe' ? 'ปลอดภัย' :
		data.zone === 'warning' ? 'ระวัง' :
		'อันตราย'
	);

	// Semicircle gauge: map probability 0-100% to 0-180deg
	const clamped = $derived(Math.max(0, Math.min(100, data?.probability ?? 0)));
	const arcLen = $derived((clamped / 100) * Math.PI * 80); // radius 80
	const fullLen = $derived(Math.PI * 80);
</script>

<div class="flex flex-col h-full">
	<div class="flex items-center justify-between mb-2">
		<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400">Risk of Ruin</p>
		{#if data?.hasEnoughData}
			<span class="text-[10px] font-medium px-1.5 py-0.5 rounded" style="background:{zoneColor}20; color:{zoneColor}">
				{zoneLabel}
			</span>
		{/if}
	</div>

	{#if !data || !data.hasEnoughData}
		<div class="flex-1 flex items-center justify-center text-center text-xs text-gray-500 py-6">
			ต้องมีอย่างน้อย 10 เทรดเพื่อคำนวณ
		</div>
	{:else}
		<div class="flex-1 flex flex-col items-center justify-center">
			<svg viewBox="0 0 200 110" class="w-full max-w-[200px]">
				<!-- Background arc -->
				<path
					d="M 20 100 A 80 80 0 0 1 180 100"
					fill="none"
					stroke="#262626"
					stroke-width="14"
					stroke-linecap="round"
				/>
				<!-- Progress arc -->
				<path
					d="M 20 100 A 80 80 0 0 1 180 100"
					fill="none"
					stroke={zoneColor}
					stroke-width="14"
					stroke-linecap="round"
					stroke-dasharray="{arcLen} {fullLen}"
				/>
				<text x="100" y="85" text-anchor="middle" fill="white" font-size="26" font-weight="600">
					{formatNumber(clamped, clamped < 10 ? 2 : 1)}%
				</text>
				<text x="100" y="102" text-anchor="middle" fill="#9ca3af" font-size="9">
					โอกาสล้างพอร์ต
				</text>
			</svg>
		</div>

		<div class="grid grid-cols-2 gap-2 mt-3 text-xs">
			<div class="rounded-lg bg-dark-bg/40 border border-dark-border px-2.5 py-1.5">
				<div class="text-[10px] text-gray-400">ความเสี่ยง/เทรด</div>
				<div class="text-sm font-semibold text-white mt-0.5">
					{formatPercent(data.riskPerTradePct).replace('+', '')}
				</div>
			</div>
			<div class="rounded-lg bg-dark-bg/40 border border-dark-border px-2.5 py-1.5">
				<div class="text-[10px] text-gray-400">จำนวนหน่วยเสี่ยง</div>
				<div class="text-sm font-semibold text-white mt-0.5">
					{data.units}
				</div>
			</div>
		</div>
	{/if}
</div>
