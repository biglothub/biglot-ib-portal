<script lang="ts">
	import { invalidate } from '$app/navigation';

	// Helper: today's datetime-local string in local timezone
	function toDatetimeLocal(d: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return (
			`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
			`T${pad(d.getHours())}:${pad(d.getMinutes())}`
		);
	}

	function nowLocal() {
		return toDatetimeLocal(new Date());
	}

	// --- State ---
	let open = $state(false);
	let saving = $state(false);
	let successId = $state<string | null>(null);
	let errorMsg = $state('');

	// Form fields
	let symbol = $state('');
	let side = $state<'BUY' | 'SELL'>('BUY');
	let profit = $state('');
	let lotSize = $state('0.01');
	let openTime = $state(nowLocal());
	let closeTime = $state(nowLocal());
	let showAdvanced = $state(false);
	let openPrice = $state('');
	let closePrice = $state('');
	let slPrice = $state('');
	let tpPrice = $state('');

	function resetForm() {
		symbol = '';
		side = 'BUY';
		profit = '';
		lotSize = '0.01';
		openTime = nowLocal();
		closeTime = nowLocal();
		showAdvanced = false;
		openPrice = '';
		closePrice = '';
		slPrice = '';
		tpPrice = '';
		errorMsg = '';
		successId = null;
	}

	function openModal() {
		resetForm();
		open = true;
	}

	function closeModal() {
		if (saving) return;
		open = false;
	}

	async function submit() {
		errorMsg = '';

		if (!symbol.trim()) {
			errorMsg = 'กรุณาระบุสัญลักษณ์ เช่น XAUUSD';
			return;
		}
		const profitNum = parseFloat(profit);
		if (isNaN(profitNum)) {
			errorMsg = 'กรุณาระบุกำไร/ขาดทุน เช่น 50 หรือ -30';
			return;
		}
		if (!openTime || !closeTime) {
			errorMsg = 'กรุณาระบุเวลาเปิดและปิด';
			return;
		}
		if (new Date(closeTime) < new Date(openTime)) {
			errorMsg = 'เวลาปิดต้องหลังเวลาเปิด';
			return;
		}

		saving = true;
		try {
			const body: Record<string, unknown> = {
				symbol: symbol.trim().toUpperCase(),
				type: side,
				profit: profitNum,
				lot_size: parseFloat(lotSize) || 0.01,
				open_time: new Date(openTime).toISOString(),
				close_time: new Date(closeTime).toISOString()
			};

			if (showAdvanced) {
				if (openPrice) body.open_price = parseFloat(openPrice) || 0;
				if (closePrice) body.close_price = parseFloat(closePrice) || 0;
				if (slPrice) body.sl = parseFloat(slPrice) || null;
				if (tpPrice) body.tp = parseFloat(tpPrice) || null;
			}

			const res = await fetch('/api/portfolio/trades/manual', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const json = await res.json().catch(() => ({}));

			if (!res.ok) {
				errorMsg = json.message || 'บันทึกเทรดไม่สำเร็จ';
				return;
			}

			successId = json.id;
			await invalidate('portfolio:baseData');

			// Auto-close after 2 seconds
			setTimeout(() => {
				open = false;
			}, 2000);
		} catch {
			errorMsg = 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่';
		} finally {
			saving = false;
		}
	}

	// Touch-based bottom-sheet dismiss (swipe down)
	let sheetEl = $state<HTMLElement | null>(null);
	let dragStartY = $state(0);
	let dragDelta = $state(0);
	let isDragging = $state(false);

	function onSheetTouchStart(e: TouchEvent) {
		dragStartY = e.touches[0].clientY;
		isDragging = true;
		dragDelta = 0;
	}

	function onSheetTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const delta = e.touches[0].clientY - dragStartY;
		if (delta > 0) {
			dragDelta = delta;
		}
	}

	function onSheetTouchEnd() {
		isDragging = false;
		if (dragDelta > 80) {
			closeModal();
		}
		dragDelta = 0;
	}
</script>

<!-- Floating "+" button (mobile only, bottom-right above bottom nav) -->
<button
	class="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/30 flex items-center justify-center transition-transform active:scale-95 hover:bg-brand-primary/90"
	onclick={openModal}
	aria-label="บันทึกเทรด"
>
	<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
	</svg>
</button>

<!-- Backdrop -->
{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="md:hidden fixed inset-0 z-50 bg-black/60"
		onclick={closeModal}
		aria-hidden="true"
	></div>

	<!-- Bottom sheet -->
	<div
		bind:this={sheetEl}
		class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-surface rounded-t-2xl shadow-2xl"
		style="transform: translateY({dragDelta}px); transition: {isDragging ? 'none' : 'transform 0.2s ease'}"
		role="dialog"
		aria-label="บันทึกเทรด"
		aria-modal="true"
	>
		<!-- Drag handle (touch to dismiss) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing"
			ontouchstart={onSheetTouchStart}
			ontouchmove={onSheetTouchMove}
			ontouchend={onSheetTouchEnd}
		>
			<div class="w-10 h-1 rounded-full bg-dark-border"></div>
		</div>

		<div class="px-4 pb-6 overflow-y-auto max-h-[85vh]">
			<!-- Header -->
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-base font-semibold text-white">บันทึกเทรด</h2>
				<button
					onclick={closeModal}
					class="w-8 h-8 rounded-full bg-dark-hover flex items-center justify-center text-gray-400 hover:text-white transition-colors"
					aria-label="ปิด"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if successId}
				<!-- Success state -->
				<div class="flex flex-col items-center justify-center py-8 gap-3">
					<div class="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
						<svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<p class="text-sm font-medium text-white">บันทึกเทรดสำเร็จ</p>
					<p class="text-xs text-gray-500">กำลังปิดหน้าต่าง...</p>
				</div>
			{:else}
				<form
					onsubmit={(e) => { e.preventDefault(); submit(); }}
					class="space-y-4"
					novalidate
				>
					<!-- Symbol + Side -->
					<div class="flex gap-3">
						<div class="flex-1">
							<label for="qt-symbol" class="block text-xs text-gray-400 mb-1.5">สัญลักษณ์ <span class="text-red-400">*</span></label>
							<input
								id="qt-symbol"
								type="text"
								bind:value={symbol}
								placeholder="เช่น XAUUSD"
								maxlength="20"
								autocomplete="off"
								autocapitalize="characters"
								class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60 uppercase"
							/>
						</div>
						<div class="shrink-0">
							<label class="block text-xs text-gray-400 mb-1.5">ทิศทาง <span class="text-red-400">*</span></label>
							<div class="flex rounded-lg overflow-hidden border border-dark-border">
								<button
									type="button"
									onclick={() => (side = 'BUY')}
									class="px-4 py-2.5 text-sm font-semibold transition-colors
										{side === 'BUY'
											? 'bg-green-500/20 text-green-400 border-r border-green-500/30'
											: 'text-gray-500 hover:text-gray-300 border-r border-dark-border'}"
									aria-pressed={side === 'BUY'}
								>
									BUY
								</button>
								<button
									type="button"
									onclick={() => (side = 'SELL')}
									class="px-4 py-2.5 text-sm font-semibold transition-colors
										{side === 'SELL'
											? 'bg-red-500/20 text-red-400'
											: 'text-gray-500 hover:text-gray-300'}"
									aria-pressed={side === 'SELL'}
								>
									SELL
								</button>
							</div>
						</div>
					</div>

					<!-- P&L + Lots -->
					<div class="flex gap-3">
						<div class="flex-1">
							<label for="qt-profit" class="block text-xs text-gray-400 mb-1.5">กำไร/ขาดทุน ($) <span class="text-red-400">*</span></label>
							<input
								id="qt-profit"
								type="number"
								inputmode="decimal"
								step="0.01"
								bind:value={profit}
								placeholder="0.00"
								class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60"
							/>
						</div>
						<div class="w-24">
							<label for="qt-lots" class="block text-xs text-gray-400 mb-1.5">Lots</label>
							<input
								id="qt-lots"
								type="number"
								inputmode="decimal"
								step="0.01"
								min="0.01"
								bind:value={lotSize}
								placeholder="0.01"
								class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60"
							/>
						</div>
					</div>

					<!-- Open time -->
					<div>
						<label for="qt-open-time" class="block text-xs text-gray-400 mb-1.5">เวลาเปิด <span class="text-red-400">*</span></label>
						<input
							id="qt-open-time"
							type="datetime-local"
							bind:value={openTime}
							class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary/60"
						/>
					</div>

					<!-- Close time -->
					<div>
						<label for="qt-close-time" class="block text-xs text-gray-400 mb-1.5">เวลาปิด <span class="text-red-400">*</span></label>
						<input
							id="qt-close-time"
							type="datetime-local"
							bind:value={closeTime}
							class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-primary/60"
						/>
					</div>

					<!-- Advanced toggle -->
					<button
						type="button"
						onclick={() => (showAdvanced = !showAdvanced)}
						class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
					>
						<svg
							class="w-3.5 h-3.5 transition-transform duration-200 {showAdvanced ? 'rotate-90' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
						{showAdvanced ? 'ซ่อนตัวเลือกเพิ่มเติม' : 'ตัวเลือกเพิ่มเติม (ราคา, SL, TP)'}
					</button>

					{#if showAdvanced}
						<div class="space-y-3 border border-dark-border rounded-xl p-3 bg-dark-bg/50">
							<div class="flex gap-3">
								<div class="flex-1">
									<label for="qt-open-price" class="block text-xs text-gray-400 mb-1.5">ราคาเปิด</label>
									<input
										id="qt-open-price"
										type="number"
										inputmode="decimal"
										step="any"
										bind:value={openPrice}
										placeholder="0.00"
										class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60"
									/>
								</div>
								<div class="flex-1">
									<label for="qt-close-price" class="block text-xs text-gray-400 mb-1.5">ราคาปิด</label>
									<input
										id="qt-close-price"
										type="number"
										inputmode="decimal"
										step="any"
										bind:value={closePrice}
										placeholder="0.00"
										class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60"
									/>
								</div>
							</div>
							<div class="flex gap-3">
								<div class="flex-1">
									<label for="qt-sl" class="block text-xs text-gray-400 mb-1.5">Stop Loss</label>
									<input
										id="qt-sl"
										type="number"
										inputmode="decimal"
										step="any"
										bind:value={slPrice}
										placeholder="0.00"
										class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60"
									/>
								</div>
								<div class="flex-1">
									<label for="qt-tp" class="block text-xs text-gray-400 mb-1.5">Take Profit</label>
									<input
										id="qt-tp"
										type="number"
										inputmode="decimal"
										step="any"
										bind:value={tpPrice}
										placeholder="0.00"
										class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/60"
									/>
								</div>
							</div>
						</div>
					{/if}

					<!-- Error message -->
					{#if errorMsg}
						<div class="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5" role="alert">
							<svg class="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<p class="text-xs text-red-300">{errorMsg}</p>
						</div>
					{/if}

					<!-- Submit -->
					<button
						type="submit"
						disabled={saving}
						class="w-full rounded-xl py-3 text-sm font-semibold transition-colors
							{saving
								? 'bg-brand-primary/40 text-white/50 cursor-not-allowed'
								: 'bg-brand-primary text-white hover:bg-brand-primary/90 active:scale-[0.98]'}"
					>
						{#if saving}
							<span class="flex items-center justify-center gap-2">
								<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
								</svg>
								กำลังบันทึก...
							</span>
						{:else}
							บันทึกเทรด
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
