<script lang="ts">
	type Tool = 'arrow' | 'circle' | 'rectangle' | 'pen' | 'text';
	type AnnotationShape =
		| { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lineWidth: number }
		| { type: 'circle'; cx: number; cy: number; rx: number; ry: number; color: string; lineWidth: number }
		| { type: 'rectangle'; x: number; y: number; w: number; h: number; color: string; lineWidth: number }
		| { type: 'pen'; points: { x: number; y: number }[]; color: string; lineWidth: number }
		| { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number };

	let {
		tradeId,
		onclose,
		onsaved
	}: {
		tradeId: string;
		onclose: () => void;
		onsaved: (attachment: { id: string; kind: string; storage_path: string; caption: string }) => void;
	} = $props();

	// State
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let image = $state<HTMLImageElement | null>(null);
	let shapes = $state<AnnotationShape[]>([]);
	let undoStack = $state<AnnotationShape[][]>([]);
	let activeTool = $state<Tool>('arrow');
	let activeColor = $state('#ef4444');
	let lineWidth = $state(3);
	let fontSize = $state(20);
	let caption = $state('');
	let saving = $state(false);
	let saveError = $state('');
	let isDrawing = $state(false);
	let startX = $state(0);
	let startY = $state(0);
	let pendingPenPoints = $state<{ x: number; y: number }[]>([]);
	let pendingTextPos = $state<{ x: number; y: number } | null>(null);
	let textInput = $state('');
	let showTextInput = $state(false);
	let loadError = $state('');

	const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

	function getCanvas() {
		return canvasEl;
	}
	function getCtx() {
		return canvasEl?.getContext('2d') ?? null;
	}

	function getCanvasCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
		const canvas = getCanvas();
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		if (e instanceof TouchEvent) {
			const t = e.touches[0] ?? e.changedTouches[0];
			return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
		}
		return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
	}

	function redraw() {
		const canvas = getCanvas();
		const ctx = getCtx();
		if (!canvas || !ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (image) {
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		}
		for (const shape of shapes) {
			drawShape(ctx, shape);
		}
	}

	function drawShape(ctx: CanvasRenderingContext2D, shape: AnnotationShape) {
		ctx.save();
		ctx.strokeStyle = shape.color;
		ctx.fillStyle = shape.color;
		if (shape.type !== 'text') ctx.lineWidth = shape.lineWidth;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		if (shape.type === 'arrow') {
			const { x1, y1, x2, y2 } = shape;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
			// Arrowhead
			const angle = Math.atan2(y2 - y1, x2 - x1);
			const headLen = Math.max(12, shape.lineWidth * 4);
			ctx.beginPath();
			ctx.moveTo(x2, y2);
			ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
			ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
			ctx.closePath();
			ctx.fill();
		} else if (shape.type === 'circle') {
			ctx.beginPath();
			ctx.ellipse(shape.cx, shape.cy, Math.abs(shape.rx), Math.abs(shape.ry), 0, 0, Math.PI * 2);
			ctx.stroke();
		} else if (shape.type === 'rectangle') {
			ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
		} else if (shape.type === 'pen') {
			if (shape.points.length < 2) return;
			ctx.beginPath();
			ctx.moveTo(shape.points[0].x, shape.points[0].y);
			for (let i = 1; i < shape.points.length; i++) {
				ctx.lineTo(shape.points[i].x, shape.points[i].y);
			}
			ctx.stroke();
		} else if (shape.type === 'text') {
			ctx.font = `bold ${shape.fontSize}px sans-serif`;
			ctx.fillText(shape.text, shape.x, shape.y);
		}
		ctx.restore();
	}

	function handlePointerDown(e: MouseEvent | TouchEvent) {
		if (!image) return;
		if (e instanceof TouchEvent) e.preventDefault();
		const { x, y } = getCanvasCoords(e);

		if (activeTool === 'text') {
			pendingTextPos = { x, y };
			textInput = '';
			showTextInput = true;
			return;
		}

		isDrawing = true;
		startX = x;
		startY = y;

		if (activeTool === 'pen') {
			pendingPenPoints = [{ x, y }];
		}
	}

	function handlePointerMove(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !image) return;
		if (e instanceof TouchEvent) e.preventDefault();
		const { x, y } = getCanvasCoords(e);

		if (activeTool === 'pen') {
			pendingPenPoints = [...pendingPenPoints, { x, y }];
			const ctx = getCtx();
			if (ctx && pendingPenPoints.length >= 2) {
				redraw();
				drawShape(ctx, { type: 'pen', points: pendingPenPoints, color: activeColor, lineWidth });
			}
			return;
		}

		// Preview shape live
		const ctx = getCtx();
		if (!ctx) return;
		redraw();

		const preview = buildShape(x, y);
		if (preview) drawShape(ctx, preview);
	}

	function buildShape(x: number, y: number): AnnotationShape | null {
		if (activeTool === 'arrow') {
			return { type: 'arrow', x1: startX, y1: startY, x2: x, y2: y, color: activeColor, lineWidth };
		} else if (activeTool === 'circle') {
			return { type: 'circle', cx: (startX + x) / 2, cy: (startY + y) / 2, rx: Math.abs(x - startX) / 2, ry: Math.abs(y - startY) / 2, color: activeColor, lineWidth };
		} else if (activeTool === 'rectangle') {
			return { type: 'rectangle', x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(x - startX), h: Math.abs(y - startY), color: activeColor, lineWidth };
		}
		return null;
	}

	function handlePointerUp(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !image) return;
		if (e instanceof TouchEvent) e.preventDefault();
		const { x, y } = getCanvasCoords(e);
		isDrawing = false;

		if (activeTool === 'pen') {
			if (pendingPenPoints.length >= 2) {
				pushShape({ type: 'pen', points: pendingPenPoints, color: activeColor, lineWidth });
			}
			pendingPenPoints = [];
			return;
		}

		const shape = buildShape(x, y);
		if (shape) pushShape(shape);
	}

	function pushShape(shape: AnnotationShape) {
		undoStack = [...undoStack, [...shapes]];
		shapes = [...shapes, shape];
		redraw();
	}

	function undo() {
		if (undoStack.length === 0) return;
		shapes = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		redraw();
	}

	function clearAll() {
		undoStack = [...undoStack, [...shapes]];
		shapes = [];
		redraw();
	}

	function commitText() {
		if (!pendingTextPos || !textInput.trim()) {
			showTextInput = false;
			pendingTextPos = null;
			return;
		}
		pushShape({ type: 'text', x: pendingTextPos.x, y: pendingTextPos.y, text: textInput.trim(), color: activeColor, fontSize });
		showTextInput = false;
		pendingTextPos = null;
		textInput = '';
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		loadError = '';

		if (!file.type.startsWith('image/')) {
			loadError = 'รองรับเฉพาะไฟล์ภาพ (PNG, JPEG, WebP)';
			return;
		}

		const reader = new FileReader();
		reader.onload = (ev) => {
			const src = ev.target?.result as string;
			const img = new Image();
			img.onload = () => {
				const canvas = getCanvas();
				if (!canvas) return;
				// Max canvas dimension 1280px wide
				const maxW = 1280;
				const scale = img.width > maxW ? maxW / img.width : 1;
				canvas.width = Math.round(img.width * scale);
				canvas.height = Math.round(img.height * scale);
				image = img;
				shapes = [];
				undoStack = [];
				redraw();
			};
			img.src = src;
		};
		reader.readAsDataURL(file);
	}

	async function saveAnnotated() {
		const canvas = getCanvas();
		if (!canvas || !image) return;
		saving = true;
		saveError = '';

		try {
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png');
			});

			const fd = new FormData();
			fd.append('file', blob, 'annotation.png');
			fd.append('caption', caption.trim());

			const res = await fetch(`/api/portfolio/trades/${tradeId}/attachments/upload`, {
				method: 'POST',
				body: fd
			});

			const body = await res.json();
			if (!res.ok) {
				saveError = body.message ?? 'บันทึกไม่สำเร็จ';
				return;
			}

			onsaved(body.attachment);
			onclose();
		} catch {
			saveError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (canvasEl && !image) {
			const ctx = canvasEl.getContext('2d');
			if (ctx) {
				canvasEl.width = 800;
				canvasEl.height = 450;
				ctx.fillStyle = '#1a1a2e';
				ctx.fillRect(0, 0, 800, 450);
				ctx.fillStyle = '#4b5563';
				ctx.font = '16px sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('คลิก "เลือกภาพ" เพื่ออัปโหลดภาพกราฟ', 400, 225);
			}
		}
	});
</script>

<!-- Modal backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
	role="dialog"
	aria-modal="true"
	aria-label="แก้ไขภาพกราฟ"
>
	<div class="flex flex-col w-full max-w-5xl bg-dark-surface border border-dark-border rounded-2xl shadow-2xl max-h-[95vh] overflow-hidden">
		<!-- Header -->
		<div class="flex items-center justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
			<h2 class="text-base font-semibold text-white">แก้ไขภาพ Screenshot</h2>
			<button
				type="button"
				onclick={onclose}
				class="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-border/50 transition-colors"
				aria-label="ปิด"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Toolbar -->
		<div class="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-dark-border bg-dark-bg/40 flex-shrink-0">
			<!-- File picker -->
			<input
				bind:this={fileInput}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				class="hidden"
				onchange={handleFileSelect}
			/>
			<button
				type="button"
				onclick={() => fileInput?.click()}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 text-sm font-medium transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
				</svg>
				เลือกภาพ
			</button>

			<div class="w-px h-6 bg-dark-border"></div>

			<!-- Tool buttons -->
			{#each [
				{ id: 'arrow', label: 'ลูกศร', icon: 'M14 5l7 7m0 0l-7 7m7-7H3' },
				{ id: 'circle', label: 'วงกลม', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
				{ id: 'rectangle', label: 'สี่เหลี่ยม', icon: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z' },
				{ id: 'pen', label: 'วาด', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
				{ id: 'text', label: 'ข้อความ', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }
			] as tool}
				<button
					type="button"
					onclick={() => { activeTool = tool.id as Tool; showTextInput = false; }}
					title={tool.label}
					aria-label={tool.label}
					class="p-2 rounded-lg text-sm transition-colors {activeTool === tool.id ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white hover:bg-dark-border/50'}"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={tool.icon} />
					</svg>
				</button>
			{/each}

			<div class="w-px h-6 bg-dark-border"></div>

			<!-- Color picker -->
			<div class="flex items-center gap-1">
				{#each COLORS as color}
					<button
						type="button"
						onclick={() => activeColor = color}
						aria-label="สีที่ {color}"
						class="w-5 h-5 rounded-full border-2 transition-all {activeColor === color ? 'border-white scale-110' : 'border-transparent hover:border-gray-400'}"
						style="background-color: {color}"
					></button>
				{/each}
			</div>

			<div class="w-px h-6 bg-dark-border"></div>

			<!-- Line width -->
			<div class="flex items-center gap-2">
				<span class="text-xs text-gray-500">ขนาด</span>
				<input
					type="range"
					min="1"
					max="10"
					bind:value={lineWidth}
					class="w-20 accent-brand-primary"
					aria-label="ขนาดเส้น"
				/>
				<span class="text-xs text-gray-400 w-4">{lineWidth}</span>
			</div>

			<div class="w-px h-6 bg-dark-border"></div>

			<!-- Undo / Clear -->
			<button
				type="button"
				onclick={undo}
				disabled={undoStack.length === 0}
				title="ย้อนกลับ"
				aria-label="ย้อนกลับ"
				class="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
				</svg>
			</button>
			<button
				type="button"
				onclick={clearAll}
				disabled={shapes.length === 0}
				title="ลบทั้งหมด"
				aria-label="ลบทั้งหมด"
				class="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-dark-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			</button>
		</div>

		<!-- Canvas area -->
		<div class="flex-1 overflow-auto bg-dark-bg/60 p-4 flex items-start justify-center relative">
			{#if loadError}
				<div class="absolute top-4 left-4 right-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
					{loadError}
				</div>
			{/if}

			<!-- Text input overlay -->
			{#if showTextInput && pendingTextPos}
				<div class="absolute z-10 top-8 left-1/2 -translate-x-1/2 bg-dark-surface border border-dark-border rounded-xl shadow-lg p-3 flex items-center gap-2 min-w-[280px]">
					<input
						type="text"
						bind:value={textInput}
						placeholder="พิมพ์ข้อความ..."
						class="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
						onkeydown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { showTextInput = false; pendingTextPos = null; } }}
					/>
					<button type="button" onclick={commitText} class="btn-primary text-xs px-3 py-1.5">ตกลง</button>
					<button type="button" onclick={() => { showTextInput = false; pendingTextPos = null; }} class="text-gray-400 text-xs">ยกเลิก</button>
				</div>
			{/if}

			<canvas
				bind:this={canvasEl}
				class="max-w-full rounded-xl shadow-xl {image ? 'cursor-crosshair' : 'cursor-default'}"
				style="touch-action: none;"
				onmousedown={handlePointerDown}
				onmousemove={handlePointerMove}
				onmouseup={handlePointerUp}
				ontouchstart={handlePointerDown}
				ontouchmove={handlePointerMove}
				ontouchend={handlePointerUp}
			></canvas>
		</div>

		<!-- Footer -->
		<div class="flex flex-wrap items-center gap-3 px-5 py-4 border-t border-dark-border bg-dark-bg/40 flex-shrink-0">
			<input
				type="text"
				bind:value={caption}
				placeholder="คำอธิบายภาพ (ไม่บังคับ)"
				class="flex-1 min-w-[200px] bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
			/>

			{#if saveError}
				<span class="text-sm text-red-400">{saveError}</span>
			{/if}

			<button
				type="button"
				onclick={onclose}
				class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-dark-border/50 transition-colors"
			>
				ยกเลิก
			</button>
			<button
				type="button"
				onclick={saveAnnotated}
				disabled={saving || !image}
				class="btn-primary text-sm py-2 px-5 disabled:opacity-50"
			>
				{saving ? 'กำลังบันทึก...' : 'บันทึก Screenshot'}
			</button>
		</div>
	</div>
</div>
