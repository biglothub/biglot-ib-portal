<script lang="ts">
	let { insights = [] }: {
		insights?: Array<{
			ruleId: string;
			category: 'positive' | 'negative' | 'warning' | 'info';
			message: string;
			date: string;
		}>;
	} = $props();

	const categoryConfig = {
		positive: { icon: '🟢', bg: 'bg-green-500/10 border-green-500/20', label: 'เชิงบวก' },
		negative: { icon: '🔴', bg: 'bg-red-500/10 border-red-500/20', label: 'เชิงลบ' },
		warning: { icon: '🟡', bg: 'bg-amber-500/10 border-amber-500/20', label: 'คำเตือน' },
		info: { icon: '🔵', bg: 'bg-blue-500/10 border-blue-500/20', label: 'ข้อมูล' }
	};

	const sortOrder = { negative: 0, warning: 1, positive: 2, info: 3 };
	const sorted = $derived([...insights].sort((a, b) => (sortOrder[a.category] || 3) - (sortOrder[b.category] || 3)));
</script>

{#if insights.length > 0}
	<div class="space-y-2">
		<h3 class="text-sm font-medium text-gray-400">วิเคราะห์ประจำวัน</h3>
		{#each sorted as insight}
			{@const config = categoryConfig[insight.category] || categoryConfig.info}
			<div class="rounded-xl border {config.bg} px-4 py-3">
				<div class="flex items-start gap-2">
					<span class="text-sm mt-0.5">{config.icon}</span>
					<p class="text-sm text-gray-200">{insight.message}</p>
				</div>
			</div>
		{/each}
	</div>
{/if}
