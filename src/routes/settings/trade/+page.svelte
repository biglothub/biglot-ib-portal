<script lang="ts">
	import type { SymbolSetting, TradeSettings } from './+page.server';

	let { data } = $props();
	let tradeSettings = $derived(data.tradeSettings);

	const EMPTY_TRADE_SETTINGS: TradeSettings = {
		timezone: 'Asia/Bangkok',
		default_tp_pips: null,
		default_sl_pips: null,
		symbol_settings: []
	};

	// Form state — synced from server data on load/invalidation
	let timezone = $state('Asia/Bangkok');
	let defaultTpPips = $state<string>('');
	let defaultSlPips = $state<string>('');
	let symbolSettings = $state<SymbolSetting[]>([]);

	let saving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// New symbol form
	let newSymbol = $state('');
	let newTp = $state('');
	let newSl = $state('');
	let newCommission = $state('');

	$effect(() => {
		const initial = tradeSettings ?? EMPTY_TRADE_SETTINGS;
		timezone = initial.timezone;
		defaultTpPips = initial.default_tp_pips?.toString() ?? '';
		defaultSlPips = initial.default_sl_pips?.toString() ?? '';
		symbolSettings = initial.symbol_settings.map((setting) => ({ ...setting }));
	});

	const timezones = [
		{ value: 'Asia/Bangkok', label: 'เอเชีย/กรุงเทพ (UTC+7)' },
		{ value: 'Asia/Tokyo', label: 'เอเชีย/โตเกียว (UTC+9)' },
		{ value: 'Asia/Singapore', label: 'เอเชีย/สิงคโปร์ (UTC+8)' },
		{ value: 'Asia/Hong_Kong', label: 'เอเชีย/ฮ่องกง (UTC+8)' },
		{ value: 'Asia/Shanghai', label: 'เอเชีย/เซี่ยงไฮ้ (UTC+8)' },
		{ value: 'Asia/Seoul', label: 'เอเชีย/โซล (UTC+9)' },
		{ value: 'Asia/Kolkata', label: 'เอเชีย/โกลกาตา (UTC+5:30)' },
		{ value: 'Asia/Dubai', label: 'เอเชีย/ดูไบ (UTC+4)' },
		{ value: 'Europe/London', label: 'ยุโรป/ลอนดอน (UTC+0)' },
		{ value: 'Europe/Berlin', label: 'ยุโรป/เบอร์ลิน (UTC+1)' },
		{ value: 'Europe/Moscow', label: 'ยุโรป/มอสโก (UTC+3)' },
		{ value: 'America/New_York', label: 'อเมริกา/นิวยอร์ก (UTC-5)' },
		{ value: 'America/Chicago', label: 'อเมริกา/ชิคาโก (UTC-6)' },
		{ value: 'America/Los_Angeles', label: 'อเมริกา/ลอสแองเจลิส (UTC-8)' },
		{ value: 'Pacific/Auckland', label: 'แปซิฟิก/โอ๊คแลนด์ (UTC+12)' },
		{ value: 'Australia/Sydney', label: 'ออสเตรเลีย/ซิดนีย์ (UTC+10)' },
		{ value: 'UTC', label: 'UTC (UTC+0)' }
	];

	function addSymbol() {
		const sym = newSymbol.trim().toUpperCase();
		if (!sym) return;
		if (symbolSettings.some((s) => s.symbol === sym)) {
			message = { type: 'error', text: `${sym} มีอยู่ในรายการแล้ว` };
			return;
		}

		symbolSettings = [
			...symbolSettings,
			{
				symbol: sym,
				default_tp_pips: newTp ? parseFloat(newTp) : null,
				default_sl_pips: newSl ? parseFloat(newSl) : null,
				commission: newCommission ? parseFloat(newCommission) : null
			}
		];
		newSymbol = '';
		newTp = '';
		newSl = '';
		newCommission = '';
		message = null;
	}

	function removeSymbol(index: number) {
		symbolSettings = symbolSettings.filter((_, i) => i !== index);
	}

	function updateSymbolField(index: number, field: keyof SymbolSetting, value: string) {
		symbolSettings = symbolSettings.map((s, i) => {
			if (i !== index) return s;
			if (field === 'symbol') return { ...s, symbol: value };
			return { ...s, [field]: value ? parseFloat(value) : null };
		});
	}

	async function handleSave() {
		saving = true;
		message = null;

		try {
			const res = await fetch('/api/settings/trade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timezone,
					default_tp_pips: defaultTpPips ? parseFloat(defaultTpPips) : null,
					default_sl_pips: defaultSlPips ? parseFloat(defaultSlPips) : null,
					symbol_settings: symbolSettings
				})
			});

			const result = await res.json();
			if (res.ok) {
				message = { type: 'success', text: result.message };
			} else {
				message = { type: 'error', text: result.message };
			}
		} catch {
			message = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			saving = false;
		}
	}
</script>

<!-- Trade Settings Tab -->
<div class="space-y-6">
	<!-- Timezone -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">โซนเวลา</h2>
				<p class="text-xs text-gray-400">เลือกโซนเวลาสำหรับแสดงผลข้อมูลเทรด</p>
			</div>
		</div>

		<div class="max-w-md">
			<label class="label" for="timezone-select">โซนเวลาที่ใช้</label>
			<select id="timezone-select" bind:value={timezone} class="input">
				{#each timezones as tz}
					<option value={tz.value}>{tz.label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Default TP/SL -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
					/>
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">ค่าเริ่มต้น TP/SL</h2>
				<p class="text-xs text-gray-400">
					กำหนดค่า Take Profit และ Stop Loss เริ่มต้น (หน่วย pips)
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-md">
			<div>
				<label class="label" for="default-tp">Take Profit (pips)</label>
				<input
					id="default-tp"
					type="number"
					min="0"
					step="0.1"
					bind:value={defaultTpPips}
					placeholder="เช่น 50"
					class="input"
				/>
			</div>
			<div>
				<label class="label" for="default-sl">Stop Loss (pips)</label>
				<input
					id="default-sl"
					type="number"
					min="0"
					step="0.1"
					bind:value={defaultSlPips}
					placeholder="เช่น 30"
					class="input"
				/>
			</div>
		</div>

		<p class="text-xs text-gray-400 mt-4">
			ค่านี้จะใช้เป็นค่าเริ่มต้นเมื่อวิเคราะห์เทรดที่ไม่ได้ตั้ง TP/SL
		</p>
	</div>

	<!-- Per-Symbol Settings -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					/>
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">ตั้งค่าต่อสัญลักษณ์</h2>
				<p class="text-xs text-gray-400">
					กำหนด TP/SL และค่าคอมมิชชันแยกตามสัญลักษณ์
				</p>
			</div>
		</div>

		<!-- Existing symbols table -->
		{#if symbolSettings.length > 0}
			<div class="hidden md:block overflow-x-auto mb-6">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border text-gray-400 text-xs">
							<th class="text-left py-2 px-3 font-medium">สัญลักษณ์</th>
							<th class="text-left py-2 px-3 font-medium">TP (pips)</th>
							<th class="text-left py-2 px-3 font-medium">SL (pips)</th>
							<th class="text-left py-2 px-3 font-medium">คอมมิชชัน ($)</th>
							<th class="text-right py-2 px-3 font-medium w-12"></th>
						</tr>
					</thead>
					<tbody>
						{#each symbolSettings as sym, i}
							<tr class="border-b border-dark-border/50 hover:bg-dark-hover/30">
								<td class="py-2 px-3">
									<span
										class="inline-block px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-xs font-mono font-medium"
									>
										{sym.symbol}
									</span>
								</td>
								<td class="py-2 px-3">
									<input
										type="number"
										min="0"
										step="0.1"
										value={sym.default_tp_pips ?? ''}
										oninput={(e) =>
											updateSymbolField(i, 'default_tp_pips', e.currentTarget.value)}
										placeholder="-"
										class="input w-24 !py-1 !text-xs"
									/>
								</td>
								<td class="py-2 px-3">
									<input
										type="number"
										min="0"
										step="0.1"
										value={sym.default_sl_pips ?? ''}
										oninput={(e) =>
											updateSymbolField(i, 'default_sl_pips', e.currentTarget.value)}
										placeholder="-"
										class="input w-24 !py-1 !text-xs"
									/>
								</td>
								<td class="py-2 px-3">
									<input
										type="number"
										min="0"
										step="0.01"
										value={sym.commission ?? ''}
										oninput={(e) =>
											updateSymbolField(i, 'commission', e.currentTarget.value)}
										placeholder="-"
										class="input w-24 !py-1 !text-xs"
									/>
								</td>
								<td class="py-2 px-3 text-right">
									<button
										type="button"
										onclick={() => removeSymbol(i)}
										class="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
										title="ลบ"
									>
										<svg
											class="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile card view -->
			<div class="md:hidden space-y-3 mb-6">
				{#each symbolSettings as sym, i}
					<div class="bg-dark-bg border border-dark-border rounded-lg p-3">
						<div class="flex items-center justify-between">
							<span class="inline-block px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-xs font-mono font-medium">{sym.symbol}</span>
							<button
								type="button"
								onclick={() => removeSymbol(i)}
								class="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
								aria-label="ลบ {sym.symbol}"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
							</button>
						</div>
						<div class="grid grid-cols-3 gap-2 mt-2 text-sm text-gray-400">
							<span>TP: {sym.default_tp_pips ?? '-'}</span>
							<span>SL: {sym.default_sl_pips ?? '-'}</span>
							<span>Com: {sym.commission ?? '-'}</span>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="rounded-lg border border-dashed border-dark-border bg-dark-bg/50 p-8 text-center mb-6"
			>
				<svg
					class="w-8 h-8 text-gray-400 mx-auto mb-2"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					/>
				</svg>
				<p class="text-sm text-gray-400">ยังไม่มีการตั้งค่าแยกตามสัญลักษณ์</p>
				<p class="text-xs text-gray-400 mt-1">เพิ่มสัญลักษณ์ด้านล่างเพื่อกำหนดค่า</p>
			</div>
		{/if}

		<!-- Add new symbol -->
		<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
			<p class="text-xs text-gray-400 font-medium mb-3">เพิ่มสัญลักษณ์ใหม่</p>
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
				<div>
					<label class="label" for="new-symbol">สัญลักษณ์</label>
					<input
						id="new-symbol"
						type="text"
						bind:value={newSymbol}
						placeholder="เช่น XAUUSD"
						maxlength="20"
						class="input !py-1.5 !text-xs font-mono uppercase"
					/>
				</div>
				<div>
					<label class="label" for="new-tp">TP (pips)</label>
					<input
						id="new-tp"
						type="number"
						min="0"
						step="0.1"
						bind:value={newTp}
						placeholder="-"
						class="input !py-1.5 !text-xs"
					/>
				</div>
				<div>
					<label class="label" for="new-sl">SL (pips)</label>
					<input
						id="new-sl"
						type="number"
						min="0"
						step="0.1"
						bind:value={newSl}
						placeholder="-"
						class="input !py-1.5 !text-xs"
					/>
				</div>
				<div>
					<label class="label" for="new-commission">คอมมิชชัน ($)</label>
					<input
						id="new-commission"
						type="number"
						min="0"
						step="0.01"
						bind:value={newCommission}
						placeholder="-"
						class="input !py-1.5 !text-xs"
					/>
				</div>
				<div>
					<button
						type="button"
						onclick={addSymbol}
						disabled={!newSymbol.trim()}
						class="w-full px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
							{newSymbol.trim()
							? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20'
							: 'bg-dark-border text-gray-400 cursor-not-allowed border border-dark-border'}"
					>
						+ เพิ่ม
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Save button + message -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
		<button
			type="button"
			onclick={handleSave}
			disabled={saving}
			class="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors
				{saving
				? 'bg-dark-border text-gray-400 cursor-not-allowed'
				: 'bg-brand-primary text-black hover:bg-brand-primary/90'}"
		>
			{#if saving}
				<span class="flex items-center gap-2">
					<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						></path>
					</svg>
					กำลังบันทึก...
				</span>
			{:else}
				บันทึกการตั้งค่า
			{/if}
		</button>

		{#if message}
			<div
				class="rounded-lg px-4 py-2.5 text-sm {message.type === 'success'
					? 'bg-green-500/10 text-green-400 border border-green-500/20'
					: 'bg-red-500/10 text-red-400 border border-red-500/20'}"
			>
				{message.text}
			</div>
		{/if}
	</div>
</div>
