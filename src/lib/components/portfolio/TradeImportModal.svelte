<script lang="ts">
	import { invalidate } from '$app/navigation';

	let { open = $bindable(false) } = $props();

	const REQUIRED_FIELDS = ['symbol', 'type', 'lot_size', 'open_price', 'close_price', 'open_time', 'close_time', 'profit'];
	const OPTIONAL_FIELDS = ['pips', 'commission', 'swap', 'sl', 'tp', 'position_id'];
	const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

	const FIELD_LABELS: Record<string, string> = {
		symbol: 'Symbol',
		type: 'Type (BUY/SELL)',
		lot_size: 'Lot Size',
		open_price: 'Open Price',
		close_price: 'Close Price',
		open_time: 'Open Time',
		close_time: 'Close Time',
		profit: 'Profit',
		pips: 'Pips',
		commission: 'Commission',
		swap: 'Swap',
		sl: 'Stop Loss',
		tp: 'Take Profit',
		position_id: 'Position ID'
	};

	// Steps: upload -> mapping -> preview -> result
	let step = $state<'upload' | 'mapping' | 'preview' | 'result'>('upload');
	let csvText = $state('');
	let fileName = $state('');
	let headers = $state<string[]>([]);
	let previewRows = $state<string[][]>([]);
	let allRows = $state<string[][]>([]);
	let columnMap = $state<Record<number, string>>({});
	let loading = $state(false);
	let error = $state('');
	let result = $state<any>(null);

	// Import history
	let importHistory = $state<any[]>([]);
	let showHistory = $state(false);
	let historyLoading = $state(false);

	function parseCsvLine(line: string): string[] {
		const res: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inQuotes) {
				if (ch === '"') {
					if (i + 1 < line.length && line[i + 1] === '"') {
						current += '"';
						i++;
					} else {
						inQuotes = false;
					}
				} else {
					current += ch;
				}
			} else if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				res.push(current.trim());
				current = '';
			} else {
				current += ch;
			}
		}
		res.push(current.trim());
		return res;
	}

	function normalizeHeader(h: string): string {
		return h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
	}

	const HEADER_ALIASES: Record<string, string> = {
		symbol: 'symbol', pair: 'symbol', instrument: 'symbol',
		type: 'type', side: 'type', direction: 'type',
		lot_size: 'lot_size', lots: 'lot_size', volume: 'lot_size', size: 'lot_size',
		open_price: 'open_price', entry_price: 'open_price', entry: 'open_price',
		close_price: 'close_price', exit_price: 'close_price', exit: 'close_price',
		open_time: 'open_time', entry_time: 'open_time', open_date: 'open_time',
		close_time: 'close_time', exit_time: 'close_time', close_date: 'close_time',
		profit: 'profit', pnl: 'profit', p_l: 'profit', net_profit: 'profit',
		pips: 'pips', commission: 'commission', swap: 'swap',
		sl: 'sl', stop_loss: 'sl', tp: 'tp', take_profit: 'tp',
		position_id: 'position_id', ticket: 'position_id', order: 'position_id', order_id: 'position_id'
	};

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		fileName = file.name;
		error = '';

		const reader = new FileReader();
		reader.onload = (ev) => {
			csvText = (ev.target?.result as string) ?? '';
			processCSV();
		};
		reader.readAsText(file);
	}

	function processCSV() {
		const lines = csvText
			.replace(/\uFEFF/, '')
			.replace(/\r\n/g, '\n')
			.replace(/\r/g, '\n')
			.split('\n')
			.filter((l) => l.trim());

		if (lines.length < 2) {
			error = 'CSV ต้องมี header + อย่างน้อย 1 แถว';
			return;
		}

		headers = parseCsvLine(lines[0]);
		const dataLines = lines.slice(1);
		allRows = dataLines.map(parseCsvLine);
		previewRows = allRows.slice(0, 5);

		// Auto-map
		const autoMap: Record<number, string> = {};
		for (let i = 0; i < headers.length; i++) {
			const normalized = normalizeHeader(headers[i]);
			const mapped = HEADER_ALIASES[normalized];
			if (mapped) autoMap[i] = mapped;
		}
		columnMap = autoMap;

		step = 'mapping';
	}

	const mappedFields = $derived(new Set(Object.values(columnMap)));
	const missingRequired = $derived(REQUIRED_FIELDS.filter((f) => !mappedFields.has(f)));

	function setColumnMapping(colIndex: number, field: string) {
		const newMap = { ...columnMap };
		// Remove existing mapping for this field
		for (const [idx, f] of Object.entries(newMap)) {
			if (f === field) delete newMap[Number(idx)];
		}
		if (field) {
			newMap[colIndex] = field;
		} else {
			delete newMap[colIndex];
		}
		columnMap = newMap;
	}

	function goToPreview() {
		if (missingRequired.length > 0) {
			error = `กรุณา map คอลัมน์: ${missingRequired.join(', ')}`;
			return;
		}
		error = '';
		step = 'preview';
	}

	async function doImport() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/portfolio/trades/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					csv: csvText,
					column_map: columnMap,
					filename: fileName
				})
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.message || 'เกิดข้อผิดพลาด';
				return;
			}

			result = data;
			step = 'result';
			await invalidate('portfolio:baseData');
		} catch {
			error = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			loading = false;
		}
	}

	async function loadHistory() {
		historyLoading = true;
		try {
			const res = await fetch('/api/portfolio/trades/import?history=1');
			if (res.ok) {
				const data = await res.json();
				importHistory = data.history ?? [];
			}
		} catch {
			// ignore
		} finally {
			historyLoading = false;
		}
	}

	function reset() {
		step = 'upload';
		csvText = '';
		fileName = '';
		headers = [];
		previewRows = [];
		allRows = [];
		columnMap = {};
		error = '';
		result = null;
	}

	function close() {
		open = false;
		reset();
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button class="absolute inset-0 bg-black/60 cursor-default" onclick={close} tabindex="-1" aria-label="ปิด"></button>

		<!-- Modal -->
		<div role="dialog" aria-modal="true" aria-labelledby="import-modal-title" class="relative bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
			<!-- Header -->
			<div class="sticky top-0 bg-dark-surface border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
				<div>
					<h2 id="import-modal-title" class="text-lg font-semibold text-white">Import Trades</h2>
					<p class="text-xs text-gray-500 mt-0.5">
						{#if step === 'upload'}อัพโหลดไฟล์ CSV
						{:else if step === 'mapping'}จับคู่คอลัมน์
						{:else if step === 'preview'}ตรวจสอบข้อมูล
						{:else}ผลลัพธ์
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => { showHistory = !showHistory; if (showHistory && importHistory.length === 0) loadHistory(); }}
						class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded border border-dark-border"
					>
						{showHistory ? 'ซ่อนประวัติ' : 'ประวัติ Import'}
					</button>
					<button type="button" onclick={close} aria-label="ปิด" class="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
				</div>
			</div>

			<div class="px-6 py-5 space-y-4">
				<!-- Import History Panel -->
				{#if showHistory}
					<div class="bg-dark-bg border border-dark-border rounded-lg p-4 space-y-3">
						<h3 class="text-sm font-medium text-white">ประวัติ Import</h3>
						{#if historyLoading}
							<div class="space-y-2">
								{#each Array(3) as _}
									<div class="h-10 bg-dark-border/30 rounded animate-pulse"></div>
								{/each}
							</div>
						{:else if importHistory.length === 0}
							<p class="text-xs text-gray-500">ยังไม่มีประวัติ import</p>
						{:else}
							<div class="space-y-2 max-h-48 overflow-y-auto">
								{#each importHistory as log}
									<div class="flex items-center justify-between text-xs bg-dark-surface rounded px-3 py-2 border border-dark-border/50">
										<div>
											<span class="text-gray-300">{log.filename || 'CSV'}</span>
											<span class="text-gray-500 ml-2">
												{new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
												{new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
											</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="text-green-400">{log.imported_count} imported</span>
											{#if log.error_count > 0}
												<span class="text-red-400">{log.error_count} errors</span>
											{/if}
											<span class="px-1.5 py-0.5 rounded text-[10px] {log.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}">
												{log.status === 'success' ? 'สำเร็จ' : 'บางส่วน'}
											</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Step 1: Upload -->
				{#if step === 'upload'}
					<div class="border-2 border-dashed border-dark-border rounded-lg p-8 text-center hover:border-brand-primary/50 transition-colors">
						<input
							type="file"
							accept=".csv,text/csv"
							onchange={handleFileSelect}
							class="hidden"
							id="csv-upload"
						/>
						<label for="csv-upload" class="cursor-pointer space-y-3 block">
							<div class="text-4xl text-gray-500">&#128196;</div>
							<div class="text-sm text-gray-300">คลิกเพื่อเลือกไฟล์ CSV</div>
							<div class="text-xs text-gray-500">รองรับไฟล์ .csv สูงสุด 500 แถว</div>
						</label>
					</div>

					<div class="bg-dark-bg rounded-lg p-4 space-y-2">
						<h4 class="text-xs font-medium text-gray-300">รูปแบบ CSV ที่รองรับ</h4>
						<p class="text-xs text-gray-500">คอลัมน์ที่จำเป็น: Symbol, Type, Lot Size, Open Price, Close Price, Open Time, Close Time, Profit</p>
						<p class="text-xs text-gray-500">คอลัมน์เพิ่มเติม (ไม่บังคับ): Pips, Commission, Swap, SL, TP, Position ID</p>
						<p class="text-xs text-gray-500">ระบบจะจับคู่ header อัตโนมัติ เช่น "Entry Price" = Open Price, "PnL" = Profit</p>
					</div>

				<!-- Step 2: Column Mapping -->
				{:else if step === 'mapping'}
					<div class="space-y-4">
						<div class="text-sm text-gray-300">
							พบ {allRows.length} แถว, {headers.length} คอลัมน์ ในไฟล์ <span class="text-white font-medium">{fileName}</span>
						</div>

						<!-- Mapping table -->
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-dark-border text-gray-500 text-xs">
										<th class="text-left py-2 pr-4">คอลัมน์ CSV</th>
										<th class="text-left py-2 pr-4">ตัวอย่างข้อมูล</th>
										<th class="text-left py-2">Map เป็น</th>
									</tr>
								</thead>
								<tbody>
									{#each headers as header, idx}
										<tr class="border-b border-dark-border/40">
											<td class="py-2 pr-4 text-gray-300 font-mono text-xs">{header}</td>
											<td class="py-2 pr-4 text-gray-500 text-xs max-w-[150px] truncate">
												{previewRows[0]?.[idx] ?? ''}
											</td>
											<td class="py-2">
												<select
													value={columnMap[idx] ?? ''}
													onchange={(e) => setColumnMapping(idx, (e.target as HTMLSelectElement).value)}
													class="bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-white w-full max-w-[180px]"
												>
													<option value="">-- ข้าม --</option>
													{#each ALL_FIELDS as field}
														<option
															value={field}
															disabled={mappedFields.has(field) && columnMap[idx] !== field}
														>
															{FIELD_LABELS[field]}{REQUIRED_FIELDS.includes(field) ? ' *' : ''}
														</option>
													{/each}
												</select>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						{#if missingRequired.length > 0}
							<div class="text-xs text-amber-400">
								ยังไม่ได้ map: {missingRequired.map(f => FIELD_LABELS[f]).join(', ')}
							</div>
						{/if}

						<div class="flex items-center gap-3">
							<button type="button" onclick={reset} class="px-4 py-2 text-sm rounded border border-dark-border text-gray-400 hover:text-white">
								ย้อนกลับ
							</button>
							<button
								type="button"
								onclick={goToPreview}
								disabled={missingRequired.length > 0}
								class="px-4 py-2 text-sm rounded bg-brand-primary text-dark-bg font-medium hover:bg-brand-primary/80 disabled:opacity-50"
							>
								ถัดไป
							</button>
						</div>
					</div>

				<!-- Step 3: Preview -->
				{:else if step === 'preview'}
					<div class="space-y-4">
						<div class="text-sm text-gray-300">
							ตรวจสอบข้อมูล {allRows.length} แถวก่อน import
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-xs">
								<thead>
									<tr class="border-b border-dark-border text-gray-500">
										<th class="text-left py-2 pr-2">#</th>
										{#each REQUIRED_FIELDS as field}
											<th class="text-left py-2 pr-2">{FIELD_LABELS[field]}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each previewRows.slice(0, 5) as row, rowIdx}
										<tr class="border-b border-dark-border/40">
											<td class="py-1.5 pr-2 text-gray-500">{rowIdx + 1}</td>
											{#each REQUIRED_FIELDS as field}
												{@const colIdx = Object.entries(columnMap).find(([, f]) => f === field)?.[0]}
												<td class="py-1.5 pr-2 text-gray-300">
													{colIdx != null ? row[Number(colIdx)] ?? '-' : '-'}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						{#if allRows.length > 5}
							<p class="text-xs text-gray-500">... และอีก {allRows.length - 5} แถว</p>
						{/if}

						<div class="flex items-center gap-3">
							<button type="button" onclick={() => { step = 'mapping'; error = ''; }} class="px-4 py-2 text-sm rounded border border-dark-border text-gray-400 hover:text-white">
								ย้อนกลับ
							</button>
							<button
								type="button"
								onclick={doImport}
								disabled={loading}
								class="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
							>
								{loading ? 'กำลัง Import...' : `Import ${allRows.length} trades`}
							</button>
						</div>
					</div>

				<!-- Step 4: Result -->
				{:else if step === 'result' && result}
					<div class="space-y-4">
						<div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center space-y-2">
							<div class="text-2xl">&#10003;</div>
							<div class="text-lg font-semibold text-green-400">Import สำเร็จ</div>
							<div class="text-sm text-gray-300">
								นำเข้า {result.imported} จาก {result.total_rows} แถว
							</div>
						</div>

						{#if result.skipped > 0}
							<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
								<div class="text-sm font-medium text-amber-400">ข้ามไป {result.skipped} แถว</div>
								{#if result.errors?.length > 0}
									<div class="space-y-1 max-h-32 overflow-y-auto">
										{#each result.errors as err}
											<div class="text-xs text-gray-400">
												แถว {err.row}: {err.error}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<div class="flex items-center gap-3">
							<button type="button" onclick={reset} class="px-4 py-2 text-sm rounded border border-dark-border text-gray-400 hover:text-white">
								Import อีกไฟล์
							</button>
							<button type="button" onclick={close} class="px-4 py-2 text-sm rounded bg-brand-primary text-dark-bg font-medium hover:bg-brand-primary/80">
								ปิด
							</button>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
						{error}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
