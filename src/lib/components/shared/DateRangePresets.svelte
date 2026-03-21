<script lang="ts">
	import { THAILAND_OFFSET_MS } from '$lib/utils';

	let {
		from = $bindable(''),
		to = $bindable(''),
		onchange
	}: {
		from: string;
		to: string;
		onchange?: () => void;
	} = $props();

	type PresetKey = 'today' | 'this_week' | 'this_month' | 'last_7' | 'last_30' | 'last_90' | 'this_year' | 'custom';

	const presets: { key: PresetKey; label: string }[] = [
		{ key: 'today', label: 'วันนี้' },
		{ key: 'this_week', label: 'สัปดาห์นี้' },
		{ key: 'this_month', label: 'เดือนนี้' },
		{ key: 'last_7', label: '7 วัน' },
		{ key: 'last_30', label: '30 วัน' },
		{ key: 'last_90', label: '90 วัน' },
		{ key: 'this_year', label: 'ปีนี้' },
		{ key: 'custom', label: 'กำหนดเอง' }
	];

	function getThailandToday(): Date {
		return new Date(Date.now() + THAILAND_OFFSET_MS);
	}

	function formatDate(d: Date): string {
		return d.toISOString().slice(0, 10);
	}

	function getPresetDates(key: PresetKey): { from: string; to: string } | null {
		const now = getThailandToday();
		const today = formatDate(now);

		switch (key) {
			case 'today':
				return { from: today, to: today };
			case 'this_week': {
				const day = now.getUTCDay();
				const mondayOffset = day === 0 ? -6 : 1 - day;
				const monday = new Date(now);
				monday.setUTCDate(now.getUTCDate() + mondayOffset);
				return { from: formatDate(monday), to: today };
			}
			case 'this_month': {
				const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
				return { from: formatDate(firstDay), to: today };
			}
			case 'last_7': {
				const d = new Date(now);
				d.setUTCDate(now.getUTCDate() - 6);
				return { from: formatDate(d), to: today };
			}
			case 'last_30': {
				const d = new Date(now);
				d.setUTCDate(now.getUTCDate() - 29);
				return { from: formatDate(d), to: today };
			}
			case 'last_90': {
				const d = new Date(now);
				d.setUTCDate(now.getUTCDate() - 89);
				return { from: formatDate(d), to: today };
			}
			case 'this_year': {
				const firstDay = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
				return { from: formatDate(firstDay), to: today };
			}
			case 'custom':
				return null;
		}
	}

	let activePreset = $derived.by(() => {
		if (!from && !to) return null;
		for (const preset of presets) {
			if (preset.key === 'custom') continue;
			const dates = getPresetDates(preset.key);
			if (dates && dates.from === from && dates.to === to) return preset.key;
		}
		return (from || to) ? 'custom' : null;
	});

	let showCustom = $state(false);

	function selectPreset(key: PresetKey) {
		if (key === 'custom') {
			showCustom = true;
			return;
		}
		showCustom = false;
		const dates = getPresetDates(key);
		if (dates) {
			from = dates.from;
			to = dates.to;
			onchange?.();
		}
	}
</script>

<div class="space-y-2">
	<div class="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
		{#each presets as preset}
			<button
				type="button"
				onclick={() => selectPreset(preset.key)}
				class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
					{activePreset === preset.key
						? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
						: 'bg-dark-bg border border-dark-border text-gray-400 hover:text-white hover:border-gray-500'}"
			>
				{preset.label}
			</button>
		{/each}
	</div>

	{#if showCustom || activePreset === 'custom'}
		<div class="flex items-center gap-2">
			<input
				type="date"
				bind:value={from}
				onchange={() => onchange?.()}
				aria-label="วันที่เริ่ม"
				class="flex-1 bg-dark-bg border border-dark-border rounded px-2.5 py-1.5 text-sm text-white"
			/>
			<span class="text-gray-600 text-xs">ถึง</span>
			<input
				type="date"
				bind:value={to}
				onchange={() => onchange?.()}
				aria-label="วันที่สิ้นสุด"
				class="flex-1 bg-dark-bg border border-dark-border rounded px-2.5 py-1.5 text-sm text-white"
			/>
		</div>
	{/if}
</div>
