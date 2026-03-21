<script lang="ts">
	let {
		score = 0,
		label = 'สุขภาพการเทรด'
	}: {
		score?: number;
		label?: string;
	} = $props();

	const clampedScore = $derived(Math.max(0, Math.min(100, Math.round(score))));
	const scoreColor = $derived(
		clampedScore >= 70 ? 'text-green-400' : clampedScore >= 40 ? 'text-amber-400' : 'text-red-400'
	);
	const ringColor = $derived(
		clampedScore >= 70 ? '#22c55e' : clampedScore >= 40 ? '#f59e0b' : '#ef4444'
	);
	const circumference = 2 * Math.PI * 40;
	const strokeDasharray = $derived(`${(clampedScore / 100) * circumference} ${circumference}`);

	const scoreLabel = $derived(
		clampedScore >= 80 ? 'ยอดเยี่ยม' :
		clampedScore >= 60 ? 'ดี' :
		clampedScore >= 40 ? 'ปานกลาง' :
		clampedScore >= 20 ? 'ต้องปรับปรุง' : 'วิกฤต'
	);
</script>

<div class="card">
	<p class="text-xs text-gray-500 uppercase tracking-wider mb-3">{label}</p>
	<div class="flex items-center gap-4">
		<!-- Circular gauge -->
		<div class="relative flex-shrink-0">
			<svg class="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
				<circle cx="50" cy="50" r="40" fill="none" stroke="#262626" stroke-width="6" />
				<circle
					cx="50" cy="50" r="40"
					fill="none"
					stroke={ringColor}
					stroke-width="6"
					stroke-dasharray={strokeDasharray}
					stroke-linecap="round"
					class="transition-all duration-700"
				/>
			</svg>
			<div class="absolute inset-0 flex items-center justify-center">
				<span class="text-lg font-bold {scoreColor}">{clampedScore}</span>
			</div>
		</div>
		<!-- Label -->
		<div>
			<p class="text-sm font-medium {scoreColor}">{scoreLabel}</p>
			<p class="text-xs text-gray-500 mt-0.5">จาก 100</p>
		</div>
	</div>
</div>
