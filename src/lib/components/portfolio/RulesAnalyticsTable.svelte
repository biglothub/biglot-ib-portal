<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let {
		analytics = []
	}: {
		analytics?: Array<{
			name: string;
			condition: string;
			streak: number;
			avgPerfFollowed: number;
			avgPerfNotFollowed: number;
			followRate: number;
			followedDays: number;
			totalDays: number;
		}>;
	} = $props();
</script>

<div>
	<h3 class="text-sm font-medium text-gray-400 mb-3">ประสิทธิภาพกฎ</h3>
	{#if analytics.length > 0}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-400 text-xs">
						<th class="text-left py-2">กฎ</th>
						<th class="text-center py-2">เงื่อนไข</th>
						<th class="text-center py-2">Streak</th>
						<th class="text-right py-2">P&L เฉลี่ย (ทำตาม)</th>
						<th class="text-right py-2">อัตราปฏิบัติ</th>
					</tr>
				</thead>
				<tbody>
					{#each analytics as rule}
						<tr class="border-b border-dark-border/40">
							<td class="py-2.5 text-white">{rule.name}</td>
							<td class="py-2.5 text-center text-gray-400 text-xs">{rule.condition}</td>
							<td class="py-2.5 text-center">
								<span class="text-white font-medium">{rule.streak}</span>
								{#if rule.streak >= 7}
									<span class="ml-0.5">🔥</span>
								{/if}
							</td>
							<td class="py-2.5 text-right font-mono {rule.avgPerfFollowed >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(rule.avgPerfFollowed)}
							</td>
							<td class="py-2.5 text-right">
								<div class="flex items-center justify-end gap-2">
									<div class="w-16 h-1.5 rounded-full bg-dark-border overflow-hidden">
										<div class="h-full rounded-full bg-brand-primary" style="width: {rule.followRate}%"></div>
									</div>
									<span class="text-xs text-gray-400 w-10 text-right">{rule.followRate.toFixed(0)}%</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-8 text-gray-400">
			<svg class="w-8 h-8 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
			</svg>
			<p class="text-sm">ยังไม่มีข้อมูลกฎ</p>
		</div>
	{/if}
</div>
