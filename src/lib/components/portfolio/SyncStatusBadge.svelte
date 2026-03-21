<script lang="ts">
	import { timeAgo } from '$lib/utils';

	interface Props {
		lastSyncedAt: string | null;
		bridgeStatus: string | null;
	}

	let { lastSyncedAt, bridgeStatus }: Props = $props();

	const isSyncing = $derived(bridgeStatus === 'running');
	const hasSynced = $derived(!!lastSyncedAt);
</script>

{#if isSyncing}
	<div class="flex items-center gap-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/30 px-2.5 py-1">
		<span class="relative flex h-2 w-2">
			<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
			<span class="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
		</span>
		<span class="text-xs font-medium text-brand-primary">กำลัง Sync...</span>
	</div>
{:else if hasSynced}
	<div class="flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/30 px-2.5 py-1" title="อัพเดทล่าสุด: {lastSyncedAt}">
		<span class="h-2 w-2 rounded-full bg-green-500"></span>
		<span class="text-xs font-medium text-green-400">Synced · {timeAgo(lastSyncedAt!)}</span>
	</div>
{:else}
	<div class="flex items-center gap-1.5 rounded-full bg-gray-500/10 border border-gray-500/30 px-2.5 py-1">
		<span class="h-2 w-2 rounded-full bg-gray-500"></span>
		<span class="text-xs font-medium text-gray-500">ไม่ได้ Sync</span>
	</div>
{/if}
