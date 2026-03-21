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

{#if analytics.length > 0}
	<div>
		<h3 class="text-sm font-medium text-gray-400 mb-3">ประสิทธิภาพกฎ</h3>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-500 text-xs">
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
	</div>
{/if}
