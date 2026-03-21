<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';

	interface Props {
		accountBalance?: number;
	}

	let { accountBalance = 0 }: Props = $props();

	interface Preset {
		symbol: string;
		riskPct: number;
		stopLossPips: number;
		tpPips: number;
		pipValue: number;
	}

	const STORAGE_KEY = 'risk-calc-presets-v1';

	let symbol = $state('EURUSD');
	let balance = $state(10000);
	let riskPct = $state(1);
	let stopLossPips = $state(20);
	let tpPips = $state(40);
	let pipValue = $state(10); // USD per pip per standard lot
	let presets = $state<Preset[]>([]);
	let savedMessage = $state('');
	let balanceInitialized = $state(false);

	// Core calculation
	let riskAmount = $derived(balance > 0 && riskPct > 0 ? balance * (riskPct / 100) : 0);
	let lotSize = $derived(
		stopLossPips > 0 && pipValue > 0 ? riskAmount / (stopLossPips * pipValue) : 0
	);
	let potentialProfit = $derived(tpPips > 0 ? lotSize * tpPips * pipValue : 0);
	let rrRatio = $derived(stopLossPips > 0 && tpPips > 0 ? tpPips / stopLossPips : 0);

	function loadPresets(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) presets = JSON.parse(raw) as Preset[];
		} catch {
			presets = [];
		}
	}

	function persistPresets(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
		} catch {
			// ignore storage errors
		}
	}

	function savePreset(): void {
		const sym = symbol.trim().toUpperCase();
		if (!sym) return;
		const newPreset: Preset = {
			symbol: sym,
			riskPct,
			stopLossPips,
			tpPips,
			pipValue
		};
		const idx = presets.findIndex((p) => p.symbol === sym);
		if (idx >= 0) {
			presets = presets.map((p, i) => (i === idx ? newPreset : p));
		} else {
			presets = [...presets, newPreset];
		}
		persistPresets();
		savedMessage = 'บันทึกแล้ว';
		setTimeout(() => {
			savedMessage = '';
		}, 2000);
	}

	function loadPreset(preset: Preset): void {
		symbol = preset.symbol;
		riskPct = preset.riskPct;
		stopLossPips = preset.stopLossPips;
		tpPips = preset.tpPips;
		pipValue = preset.pipValue;
	}

	function deletePreset(sym: string, e: MouseEvent): void {
		e.stopPropagation();
		presets = presets.filter((p) => p.symbol !== sym);
		persistPresets();
	}

	function formatLot(lot: number): string {
		if (lot <= 0) return '0.00';
		return lot.toFixed(2);
	}

	function formatRR(rr: number): string {
		if (rr <= 0) return '-';
		return `1:${rr.toFixed(2)}`;
	}

	onMount(() => {
		loadPresets();
		if (!balanceInitialized && accountBalance > 0) {
			balance = accountBalance;
			balanceInitialized = true;
		}
	});

	$effect(() => {
		if (!balanceInitialized && accountBalance > 0) {
			balance = accountBalance;
			balanceInitialized = true;
		}
	});
</script>

<div class="card">
	<!-- Header -->
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c-.99.143-1.99.317-2.98.52m2.98-.52L5.13 15.197c-.122.499.106 1.028.589 1.202a5.989 5.989 0 002.031.352 5.989 5.989 0 002.031-.352c.483-.174.711-.703.59-1.202L5.25 4.971z"
					/>
				</svg>
			</div>
			<div>
				<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">เครื่องมือ</p>
				<h2 class="text-base font-semibold text-white">คำนวณขนาด Position</h2>
			</div>
		</div>
	</div>

	<!-- Inputs -->
	<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
		<!-- Symbol -->
		<div>
			<label class="mb-1 block text-[11px] text-gray-500" for="rc-symbol">สัญลักษณ์</label>
			<input
				id="rc-symbol"
				type="text"
				bind:value={symbol}
				placeholder="เช่น EURUSD"
				class="w-full rounded-lg border border-dark-border bg-dark-bg/50 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none"
			/>
		</div>

		<!-- Account balance -->
		<div>
			<label class="mb-1 block text-[11px] text-gray-500" for="rc-balance"
				>ยอดเงินในบัญชี (USD)</label
			>
			<input
				id="rc-balance"
				type="number"
				bind:value={balance}
				min="0"
				step="100"
				class="w-full rounded-lg border border-dark-border bg-dark-bg/50 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none"
			/>
		</div>

		<!-- Risk % -->
		<div>
			<div class="mb-1 flex items-center justify-between">
				<label class="text-[11px] text-gray-500" for="rc-risk">ความเสี่ยง</label>
				<span class="text-[11px] font-medium text-amber-400">{riskPct}%</span>
			</div>
			<input
				id="rc-risk"
				type="range"
				bind:value={riskPct}
				min="0.1"
				max="5"
				step="0.1"
				class="w-full accent-amber-500"
			/>
			<div class="mt-1 flex justify-between text-[10px] text-gray-600">
				<span>0.1%</span>
				<span>2.5%</span>
				<span>5%</span>
			</div>
		</div>

		<!-- Pip value -->
		<div>
			<label class="mb-1 block text-[11px] text-gray-500" for="rc-pipvalue"
				>Pip Value (USD / pip / lot)</label
			>
			<input
				id="rc-pipvalue"
				type="number"
				bind:value={pipValue}
				min="0.01"
				step="0.1"
				class="w-full rounded-lg border border-dark-border bg-dark-bg/50 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none"
			/>
		</div>

		<!-- Stop loss -->
		<div>
			<label class="mb-1 block text-[11px] text-gray-500" for="rc-sl">Stop Loss (pips)</label>
			<input
				id="rc-sl"
				type="number"
				bind:value={stopLossPips}
				min="0.1"
				step="0.5"
				class="w-full rounded-lg border border-dark-border bg-dark-bg/50 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none"
			/>
		</div>

		<!-- Take profit -->
		<div>
			<label class="mb-1 block text-[11px] text-gray-500" for="rc-tp">Take Profit (pips)</label>
			<input
				id="rc-tp"
				type="number"
				bind:value={tpPips}
				min="0"
				step="0.5"
				class="w-full rounded-lg border border-dark-border bg-dark-bg/50 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none"
			/>
		</div>
	</div>

	<!-- Result box -->
	<div class="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
		<!-- Primary: lot size -->
		<div class="text-center">
			<p class="text-[11px] text-gray-500">ขนาด Lot ที่แนะนำ</p>
			<p class="mt-1 text-4xl font-bold tracking-tight text-amber-400">
				{formatLot(lotSize)}
			</p>
			<p class="mt-0.5 text-[11px] text-gray-600">Standard Lots</p>
		</div>

		<!-- Secondary metrics -->
		<div class="mt-4 grid grid-cols-3 gap-3 border-t border-amber-500/10 pt-4">
			<div class="text-center">
				<p class="text-[10px] text-gray-500">ความเสี่ยง</p>
				<p class="mt-1 text-sm font-semibold text-red-400">
					{formatCurrency(riskAmount)}
				</p>
			</div>
			<div class="text-center">
				<p class="text-[10px] text-gray-500">กำไรคาดหวัง</p>
				<p class="mt-1 text-sm font-semibold text-green-400">
					{tpPips > 0 ? formatCurrency(potentialProfit) : '-'}
				</p>
			</div>
			<div class="text-center">
				<p class="text-[10px] text-gray-500">R:R Ratio</p>
				<p
					class="mt-1 text-sm font-semibold {rrRatio >= 2
						? 'text-green-400'
						: rrRatio >= 1
							? 'text-amber-400'
							: 'text-red-400'}"
				>
					{formatRR(rrRatio)}
				</p>
			</div>
		</div>
	</div>

	<!-- Presets -->
	<div class="mt-4">
		<div class="flex items-center justify-between">
			<p class="text-[11px] text-gray-500">Preset ที่บันทึกไว้</p>
			<button
				onclick={savePreset}
				class="flex items-center gap-1 rounded-lg border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-400 transition-colors hover:bg-amber-500/10"
				aria-label="บันทึก preset ปัจจุบัน"
			>
				{#if savedMessage}
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
					</svg>
					{savedMessage}
				{:else}
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
						/>
					</svg>
					บันทึก
				{/if}
			</button>
		</div>

		{#if presets.length === 0}
			<div class="mt-2 rounded-lg border border-dashed border-dark-border px-3 py-4 text-center">
				<p class="text-[11px] text-gray-600">ยังไม่มี preset — กดบันทึกเพื่อเก็บค่าปัจจุบัน</p>
			</div>
		{:else}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each presets as preset}
					<button
						onclick={() => loadPreset(preset)}
						class="group flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-bg/30 px-3 py-1.5 text-[11px] text-gray-300 transition-all hover:border-amber-500/40 hover:text-white"
						title="{preset.symbol}: Risk {preset.riskPct}%, SL {preset.stopLossPips}p / TP {preset.tpPips}p"
					>
						<span class="font-medium">{preset.symbol}</span>
						<span class="text-gray-600">{preset.riskPct}%</span>
						<span
							onclick={(e) => deletePreset(preset.symbol, e)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && deletePreset(preset.symbol, e as unknown as MouseEvent)}
							class="ml-0.5 text-gray-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
							aria-label="ลบ preset {preset.symbol}"
						>
							&times;
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Mini guide -->
	<p class="mt-4 text-[10px] leading-relaxed text-gray-700">
		Pip Value ปกติ: Forex major pairs = 10 USD/pip/lot • Gold (XAUUSD) = 1 USD/pip/lot •
		ปรับค่าตามสัญลักษณ์ที่ใช้
	</p>
</div>
