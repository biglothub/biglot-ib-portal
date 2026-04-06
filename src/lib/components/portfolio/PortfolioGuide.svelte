<script lang="ts">
	import { fly, fade } from 'svelte/transition';

	let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

	let activeSection = $state('overview');

	const sections = [
		{ id: 'overview', label: 'Overview', icon: '📊' },
		{ id: 'dayview', label: 'Day View', icon: '📅' },
		{ id: 'trades', label: 'Trades', icon: '📋' },
		{ id: 'journal', label: 'Journal', icon: '📓' },
		{ id: 'reports', label: 'Reports', icon: '📈' },
		{ id: 'calendar', label: 'Calendar', icon: '🗓️' },
		{ id: 'playbook', label: 'Playbook', icon: '📘' },
		{ id: 'progress', label: 'Progress', icon: '🎯' },
		{ id: 'livetrade', label: 'Live Trade', icon: '🎙️' },
		{ id: 'multiaccount', label: 'Multi-Account', icon: '🏦' },
		{ id: 'social', label: 'Social', icon: '🏆' },
		{ id: 'analysis', label: 'Gold Analysis', icon: '🥇' },
		{ id: 'ai', label: 'AI Chat', icon: '🤖' },
		{ id: 'tools', label: 'Tools', icon: '🔧' }
	];
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Escape' && onclose()}
		role="button"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Guide Panel — centered modal -->
	<div
		class="fixed inset-0 z-[101] flex items-center justify-center p-4 md:p-8"
		transition:fade={{ duration: 150 }}
	>
	<div
		class="w-full max-w-3xl max-h-[90vh] bg-dark-surface border border-dark-border rounded-2xl shadow-2xl flex flex-col"
		transition:fly={{ y: 30, duration: 250 }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-dark-border shrink-0">
			<div>
				<h2 class="text-lg font-bold text-white">คู่มือการใช้งาน Portfolio</h2>
				<p class="text-xs text-gray-400 mt-0.5">เรียนรู้วิธีใช้งานทุกฟีเจอร์แบบ Step-by-Step</p>
			</div>
			<button onclick={onclose} class="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors" aria-label="ปิด">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
			</button>
		</div>

		<!-- Section tabs -->
		<div class="flex gap-1 px-4 py-3 border-b border-dark-border overflow-x-auto shrink-0">
			{#each sections as section}
				<button
					onclick={() => activeSection = section.id}
					class="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors
						{activeSection === section.id
						? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
						: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				>
					{section.icon} {section.label}
				</button>
			{/each}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

			{#if activeSection === 'overview'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Overview — ภาพรวมพอร์ต</h3>
						<p class="text-sm text-gray-400">หน้าแรกที่แสดงข้อมูลสำคัญทั้งหมดในที่เดียว ออกแบบมาให้เห็นสุขภาพพอร์ตใน 3 วินาที</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ดู KPI Cards (แถวบน)</div>
							<p class="text-sm text-gray-300">4 การ์ดหลักแสดงสุขภาพพอร์ตทันที:</p>
							<ul class="mt-2 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Net P&L</span> — กำไร/ขาดทุนสุทธิทั้งหมด + จำนวน trades</li>
								<li><span class="text-white font-medium">Trade Win Rate</span> — % trade ที่ชนะ + donut chart แสดงสัดส่วน W/L</li>
								<li><span class="text-white font-medium">Profit Factor</span> — กำไรรวม / ขาดทุนรวม (>1.5 = ดี, >2 = ดีมาก)</li>
								<li><span class="text-white font-medium">Day Win Rate</span> — % วันที่กำไร + จำนวน winning/losing days</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — ดู KPI Cards (แถวล่าง)</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Balance</span> — ยอดเงินในบัญชี</li>
								<li><span class="text-white font-medium">Equity</span> — มูลค่ารวม floating P/L</li>
								<li><span class="text-white font-medium">Avg Win/Loss</span> — อัตราส่วน avg win ÷ avg loss + dual bar chart แสดงสัดส่วนจริง</li>
								<li><span class="text-white font-medium">Expectancy</span> — กำไรเฉลี่ยที่คาดหวังต่อ trade</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — ดู Charts</div>
							<p class="text-sm text-gray-400">มี 3 กราฟหลัก:</p>
							<ul class="mt-2 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Equity Growth</span> — เส้น equity/balance ตามเวลา เลือกช่วง 1D-1Y ได้</li>
								<li><span class="text-white font-medium">Cumulative P&L</span> — กราฟ area แสดงกำไรสะสม hover ดูค่าจุดใดก็ได้</li>
								<li><span class="text-white font-medium">Net Daily P&L</span> — bar chart สีเขียว (กำไร) / แดง (ขาดทุน) รายวัน</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — Trading Score (Radar 6 แกน)</div>
							<p class="text-sm text-gray-300">Radar chart วัดคุณภาพการเทรดจาก 6 มิติ:</p>
							<ul class="mt-2 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Win %</span> — อัตราชนะ</li>
								<li><span class="text-white font-medium">Profit Factor</span> — อัตราส่วนกำไร/ขาดทุน</li>
								<li><span class="text-white font-medium">Avg W/L</span> — ขนาด trade ชนะ vs แพ้</li>
								<li><span class="text-white font-medium">Recovery</span> — ความสามารถฟื้นจาก drawdown</li>
								<li><span class="text-white font-medium">Drawdown</span> — ยิ่ง drawdown น้อย คะแนนยิ่งสูง</li>
								<li><span class="text-white font-medium">Consistency</span> — ความสม่ำเสมอของผลลัพธ์</li>
							</ul>
							<p class="mt-2 text-sm text-gray-400">คะแนน 0-100: <span class="text-green-400">70+</span> = ดี, <span class="text-amber-400">40-69</span> = ปานกลาง, <span class="text-red-400">&lt;40</span> = ต้องปรับปรุง</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 5 — Command Center + ส่วนล่าง</div>
							<ul class="space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">What needs attention</span> — Day P/L, trades, reviewed, journal status + ลิงก์ review/journal</li>
								<li><span class="text-white font-medium">Unreviewed trades</span> — trade ที่ยังไม่ได้รีวิว (กดเข้ารีวิวทันที)</li>
								<li><span class="text-white font-medium">Cost of mistakes</span> — จำนวน rule breaks + มูลค่าความเสียหาย</li>
								<li><span class="text-white font-medium">Setup Performance</span> — playbook ไหนทำกำไรสูงสุด</li>
								<li><span class="text-white font-medium">Open Positions</span> — ตำแหน่งที่เปิดอยู่พร้อม P/L ปัจจุบัน</li>
								<li><span class="text-white font-medium">Trading Calendar</span> — ปฏิทินสีตาม P&L รายวัน</li>
								<li><span class="text-white font-medium">Recent Trades</span> — 8 trades ล่าสุดพร้อม review status</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'dayview'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Day View — มุมมองรายวัน/สัปดาห์</h3>
						<p class="text-sm text-gray-400">ดู performance ทีละวัน หรือสรุปรายสัปดาห์ สลับมุมมองได้</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — เลือก Day หรือ Week</div>
							<p class="text-sm text-gray-400">กดปุ่ม <span class="text-white">Day</span> / <span class="text-white">Week</span> ด้านบนซ้าย</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — Day View</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Calendar</span> — กดวันที่เลือก วันที่มี trade จะมีสี (เขียว=กำไร, แดง=ขาดทุน)</li>
								<li><span class="text-white font-medium">Daily Summary</span> — P&L, จำนวน trades, win rate, W/L</li>
								<li><span class="text-white font-medium">Intraday P&L Chart</span> — กราฟแสดง cumulative P&L ระหว่างวัน</li>
								<li><span class="text-white font-medium">+ Add note</span> — กดเพื่อสร้าง note ใน Journal สำหรับวันนี้</li>
								<li><span class="text-white font-medium">Trade List</span> — ตาราง trades ของวัน (เวลา, symbol, side, lot, entry/exit, P&L)</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Week View</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Day Cards</span> — 7 การ์ด (อา-ส) แสดง P&L + จำนวน trades ต่อวัน</li>
								<li><span class="text-white font-medium">Weekly Summary</span> — Total Trades, Win Rate, Profit Factor, W/L</li>
								<li><span class="text-white font-medium">Daily P&L Bar Chart</span> — bar chart เปรียบเทียบ P&L รายวัน</li>
								<li><span class="text-white font-medium">Trade List</span> — trades ทั้งสัปดาห์</li>
								<li>ใช้ปุ่ม <span class="text-white">◀ ▶</span> เลื่อนสัปดาห์</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'trades'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Trades — กล่องรีวิว</h3>
						<p class="text-sm text-gray-400">ดู trade ทั้งหมด กรอง จัดกลุ่ม รีวิว Bulk Actions และ CSV Import/Export</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ใช้ Filter Bar (12 มิติ)</div>
							<p class="text-sm text-gray-400">กรองได้ตาม:</p>
							<ul class="mt-2 space-y-1 text-sm text-gray-400">
								<li>ช่วงวันที่, Symbol, Direction (Buy/Sell), Session (Asian/London/NY)</li>
								<li>สถานะ Review, Playbook, Tags, มี Notes / Attachments หรือไม่</li>
								<li>ผลลัพธ์ (Win/Loss/Breakeven), ระยะเวลาถือ (Scalp/Intraday/Swing/Position)</li>
							</ul>
							<p class="mt-2 text-sm text-gray-400">กด <span class="text-white">Save View</span> เพื่อบันทึก filter ที่ใช้บ่อย — เรียกใช้ซ้ำได้จาก Saved Views</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — อ่าน Insights + Quality Score</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Insights</span> — badge สีเขียว/แดง/เหลืองแสดงจำนวน insights ที่ AI ตรวจพบ (เช่น loss streak, ไม่มี SL, big winner)</li>
								<li><span class="text-white font-medium">Quality</span> — progress bar 0-100 วัดคุณภาพ trade จาก 8 ปัจจัย (risk management, plan adherence, review, outcome, execution, sizing, R:R, documentation)</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Bulk Actions</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">เลือกหลาย trades</span> — ติ๊กเลือก trades ที่ต้องการ หรือกด Select All</li>
								<li><span class="text-white font-medium">Bulk Tag</span> — เพิ่ม/ลบ tags ให้ trades ที่เลือกพร้อมกัน</li>
								<li><span class="text-white font-medium">Bulk Playbook</span> — กำหนด playbook ให้หลาย trades ในครั้งเดียว</li>
								<li><span class="text-white font-medium">Bulk Review</span> — mark reviewed หลาย trades พร้อมกัน</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — CSV Import / Export</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Import CSV</span> — นำเข้า trades จากไฟล์ CSV (รองรับ MT4/MT5 format) กดปุ่ม Import ด้านบน → เลือกไฟล์ → map columns → confirm</li>
								<li><span class="text-white font-medium">Export CSV</span> — ส่งออก trades ที่กรองแล้วเป็น CSV ดาวน์โหลดไปใช้ใน Excel/Google Sheets</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 5 — กดเข้า Trade Detail</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Trade Insights</span> — AI วิเคราะห์ trade นี้อัตโนมัติ (10 rules: no SL, loss streak, exceed avg profit, long hold, etc.)</li>
								<li><span class="text-white font-medium">Quality Score</span> — คะแนนคุณภาพ 0-100 พร้อม gradient bar</li>
								<li><span class="text-white font-medium">Tags</span> — เพิ่ม/ลบ tags (setup, mistake, emotion, market condition, custom)</li>
								<li><span class="text-white font-medium">Notes</span> — เขียน note + ให้คะแนน 1-5 ดาว</li>
								<li><span class="text-white font-medium">Review</span> — เลือก Playbook, เหตุผลเข้า/ออก, ข้อผิดพลาด, บทเรียน, คะแนนวินัย 4 มิติ</li>
								<li><span class="text-white font-medium">Attachments</span> — แนบลิงก์หรือ chart screenshot</li>
								<li><span class="text-white font-medium">Chart Context</span> — ดู candlestick chart ของ trade + entry/exit markers</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 6 — Trade Replay</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Replay Mode</span> — ในหน้า Trade Detail กดปุ่ม Replay เพื่อย้อนดู price action ของ trade</li>
								<li><span class="text-white font-medium">Playback Controls</span> — Play/Pause, ปรับความเร็ว (1x, 2x, 5x, 10x), เลื่อน timeline</li>
								<li><span class="text-white font-medium">Entry/Exit Markers</span> — จุด entry และ exit ปักบน chart ให้เห็นชัด</li>
								<li><span class="text-white font-medium">ประโยชน์</span> — ทบทวนว่า trade เข้า/ออกถูกจังหวะหรือไม่ ฝึกสังเกต pattern ย้อนหลัง</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'journal'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Journal — สมุดบันทึกประจำวัน</h3>
						<p class="text-sm text-gray-400">บันทึก pre-market plan, post-market review, mood, และ discipline score ทุกวัน</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — เลือกวันจากปฏิทิน</div>
							<p class="text-sm text-gray-400">คลิกวันที่ — สีเขียว = กำไร, สีแดง = ขาดทุน, จุดสีน้ำเงิน = มี journal แล้ว</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — เขียน Pre-Market Plan</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Market Bias</span> — มุมมอง Bullish / Bearish / Neutral</li>
								<li><span class="text-white font-medium">Key Levels</span> — ระดับราคาสำคัญ</li>
								<li><span class="text-white font-medium">Session Plan</span> — แผนเทรดวันนี้</li>
								<li><span class="text-white font-medium">Checklist</span> — รายการตรวจสอบก่อนเทรด</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — เขียน Post-Market Review</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Post-Market Notes</span> — สรุปสิ่งที่เกิดขึ้น</li>
								<li><span class="text-white font-medium">Mood / Energy / Discipline / Confidence</span> — ให้คะแนน 1-10</li>
								<li><span class="text-white font-medium">Lessons</span> — บทเรียนที่ได้</li>
								<li><span class="text-white font-medium">Tomorrow's Focus</span> — สิ่งที่จะโฟกัสพรุ่งนี้</li>
								<li><span class="text-white font-medium">Completion</span> — กด "Complete" เพื่อนับ streak</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'reports'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Reports — วิเคราะห์เชิงลึก</h3>
						<p class="text-sm text-gray-400">5 มุมมอง + Export PDF สำหรับวิเคราะห์ performance ทุกมิติ</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Tab 1 — Overview</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Your Stats</span> — ตาราง 30+ metrics (Total P&L, Win/Loss trades, Largest Win/Loss, Max Consecutive Wins/Losses, Best/Worst Month, Sharpe/Sortino/Calmar ratios ฯลฯ)</li>
								<li><span class="text-white font-medium">Risk Metrics</span> — Sharpe, Sortino, Calmar ratios + Day-of-week performance</li>
								<li><span class="text-white font-medium">Setup Performance</span> — playbook ไหนทำกำไรสูงสุด</li>
								<li><span class="text-white font-medium">Session / Duration / Mistake</span> — breakdown ตาม session, ระยะถือ, ข้อผิดพลาด</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Tab 2 — Performance (Dual Charts)</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">2 Charts เคียงกัน</span> — แต่ละ chart เลือก metric ได้: Net P&L Cumulative, Net P&L, Win Rate, Profit Factor, Trade Count, Avg Win/Loss</li>
								<li><span class="text-white font-medium">Timeframe toggle</span> — Day / Week / Month</li>
								<li>Charts เป็น interactive — hover ดู tooltip, zoom, scroll</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Tab 3 — Calendar (Year View)</div>
							<p class="text-sm text-gray-400">ปฏิทินทั้งปี 12 เดือน — แต่ละวันมีสี (เขียว=กำไร, แดง=ขาดทุน) hover ดู P&L + จำนวน trades ใช้ปุ่ม ◀ ▶ เปลี่ยนปี</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Tab 4 — Symbols</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Bar Chart</span> — แสดง P&L ต่อ symbol (top 8) แบบ horizontal</li>
								<li><span class="text-white font-medium">Table</span> — Symbol, Trades, Win Rate, PF, Net P&L, Avg P&L — คลิก header เพื่อ sort</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Tab 5 — Compare</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li>เลือก 2 กลุ่ม (Group 1 vs Group 2) filter ตาม Symbol + Side</li>
								<li>กด <span class="text-white font-medium">Generate Report</span> → ดูเทียบ: Trades, Win Rate, PF, Net P&L, Avg P&L + highlight ตัวที่ดีกว่า</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Export PDF</div>
							<p class="text-sm text-gray-400">กดปุ่ม <span class="text-white font-medium">Export PDF</span> มุมขวาบน → ดาวน์โหลด report เป็น PDF พร้อม KPI, stats, symbol breakdown</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'calendar'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Calendar — ปฏิทินเทรดเต็มหน้าจอ</h3>
						<p class="text-sm text-gray-400">ปฏิทินขนาดใหญ่แสดง P&L รายวัน/รายเดือน พร้อมสรุปสถิติ ใช้วางแผนและทบทวนผลงานระยะยาว</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ดูภาพรวมรายเดือน</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Monthly Grid</span> — ปฏิทินเต็มหน้าจอแสดง P&L ทุกวัน สีเขียว = กำไร, สีแดง = ขาดทุน</li>
								<li><span class="text-white font-medium">Daily P&L</span> — ตัวเลข P&L แสดงในแต่ละช่องวัน</li>
								<li><span class="text-white font-medium">Trade Count</span> — จำนวน trades ของแต่ละวัน</li>
								<li>ใช้ปุ่ม <span class="text-white">◀ ▶</span> เปลี่ยนเดือน หรือกด Today เพื่อกลับเดือนปัจจุบัน</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — สรุปสถิติรายเดือน</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Monthly P&L</span> — กำไร/ขาดทุนรวมของเดือน</li>
								<li><span class="text-white font-medium">Trading Days</span> — จำนวนวันที่เทรด</li>
								<li><span class="text-white font-medium">Win Days / Loss Days</span> — จำนวนวันกำไรและวันขาดทุน</li>
								<li><span class="text-white font-medium">Best / Worst Day</span> — วันที่ทำกำไรสูงสุดและขาดทุนมากสุด</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — คลิกวันเพื่อดูรายละเอียด</div>
							<p class="text-sm text-gray-400">กดที่วันใดก็ได้ → ดู trades ของวันนั้น, P&L breakdown, และลิงก์ไปยัง Day View / Journal ของวันนั้นโดยตรง</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'playbook'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Playbook — จัดการ Trading Setup</h3>
						<p class="text-sm text-gray-400">สร้าง setup เพื่อใช้อ้างอิงเมื่อรีวิว trades ดู performance ของแต่ละ setup + เรียกดู Community Playbooks</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — สร้าง Playbook</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Name + Description</span> — ชื่อและอธิบาย setup</li>
								<li><span class="text-white font-medium">Entry Criteria</span> — เงื่อนไขเข้า (checklist)</li>
								<li><span class="text-white font-medium">Exit Criteria</span> — เงื่อนไขออก</li>
								<li><span class="text-white font-medium">Risk Rules</span> — กฎจัดการความเสี่ยง</li>
								<li><span class="text-white font-medium">Mistakes to Avoid</span> — ข้อผิดพลาดที่ห้ามทำ</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — ดู Performance</div>
							<p class="text-sm text-gray-400">แต่ละ playbook แสดง: จำนวน trades, win rate, profit factor, expectancy, total P&L — ใช้ดูว่า setup ไหน <span class="text-green-400">ทำงานจริง</span> และไหน <span class="text-red-400">ควรเลิกใช้</span></p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Community Playbooks</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Tab Community</span> — สลับไปแท็บ Community เพื่อดู playbooks ที่ trader คนอื่นแชร์ไว้</li>
								<li><span class="text-white font-medium">Browse & Search</span> — ค้นหา playbook ตามชื่อ, symbol, strategy type</li>
								<li><span class="text-white font-medium">Copy to Mine</span> — กด Copy เพื่อนำ playbook ของคนอื่นมาใช้ในพอร์ตของคุณ</li>
								<li><span class="text-white font-medium">Share</span> — แชร์ playbook ของคุณให้ community ได้จากปุ่ม Share ใน playbook ของตัวเอง</li>
								<li><span class="text-white font-medium">Rating & Downloads</span> — ดูคะแนนและจำนวนคนที่นำไปใช้</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'progress'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Progress — Discipline Tracker</h3>
						<p class="text-sm text-gray-400">ติดตามเป้าหมาย, daily checklist, heatmap, และ rules analytics</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ตั้งเป้าหมาย</div>
							<p class="text-sm text-gray-400">5 ประเภท: Review Completion, Journal Streak, Max Rule Breaks, Profit Factor, Win Rate — กดตัวเลขเพื่อปรับค่า</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — Discipline Heatmap</div>
							<p class="text-sm text-gray-400">GitHub-style heatmap 12 สัปดาห์ — ยิ่งสีเข้ม = ทำ checklist ครบมากขึ้น แสดง streak ปัจจุบัน</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Daily Checklist</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Manual Rules</span> — เช่น "Review market structure", "Set daily loss limit" — กด check/uncheck ด้วยมือ</li>
								<li><span class="text-white font-medium">Automated Rules</span> — ระบบตรวจอัตโนมัติ เช่น "All trades have SL" (100%), "Journal completed", "Max loss per trade &lt; $100"</li>
								<li><span class="text-white font-medium">+ Add rule</span> — เพิ่ม rule ใหม่ได้</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — Rules Performance Table</div>
							<p class="text-sm text-gray-400">ตารางวิเคราะห์ per-rule:</p>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Condition</span> — เงื่อนไขของ rule</li>
								<li><span class="text-white font-medium">Streak</span> — จำนวนวันติดต่อกันที่ทำตาม (มีไฟ เมื่อ 7+ วัน)</li>
								<li><span class="text-white font-medium">Avg P&L (followed)</span> — P&L เฉลี่ยของวันที่ทำตาม rule</li>
								<li><span class="text-white font-medium">Follow Rate</span> — % วันที่ทำตาม + progress bar</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'livetrade'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Live Trade — ตาราง Coach / Live Session</h3>
						<p class="text-sm text-gray-400">ดูตารางเทรดสดกับ coach, เข้าร่วม session, และดู session ย้อนหลัง</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ดูตาราง Coach Schedule</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Schedule List</span> — รายการ live session ที่กำลังจะมาถึง (วัน, เวลา, coach, หัวข้อ)</li>
								<li><span class="text-white font-medium">Status Badge</span> — LIVE (กำลังถ่ายทอด), Upcoming (เร็วๆ นี้), Completed (จบแล้ว)</li>
								<li><span class="text-white font-medium">Coach Profile</span> — ดูประวัติและสถิติของ coach</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — เข้าร่วม Live Session</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Join</span> — กดปุ่ม Join เมื่อ session เป็น LIVE เพื่อเข้าร่วม</li>
								<li><span class="text-white font-medium">Set Reminder</span> — กดปุ่มเตือนเพื่อรับ notification ก่อน session เริ่ม</li>
								<li><span class="text-white font-medium">Chat</span> — พิมพ์คำถามในห้อง chat ระหว่าง live session</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — ดู Session ย้อนหลัง</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Replay</span> — session ที่จบแล้วสามารถดูย้อนหลังได้</li>
								<li><span class="text-white font-medium">Key Takeaways</span> — สรุปประเด็นสำคัญจาก session</li>
								<li><span class="text-white font-medium">Related Trades</span> — trades ที่เกี่ยวข้องกับ session นั้นๆ</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'multiaccount'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Multi-Account — จัดการหลายบัญชี</h3>
						<p class="text-sm text-gray-400">เชื่อมต่อหลายบัญชี MT5 เปรียบเทียบ performance และสลับดูข้อมูลแต่ละบัญชี</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — เพิ่มบัญชี</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Add Account</span> — กดปุ่มเพิ่มบัญชีใหม่ กรอก MT5 account number และ server</li>
								<li><span class="text-white font-medium">Account Label</span> — ตั้งชื่อ label ให้จำง่าย เช่น "Gold Account", "Prop Firm"</li>
								<li><span class="text-white font-medium">Auto Sync</span> — ระบบ sync trades จากทุกบัญชีอัตโนมัติ</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — สลับบัญชี</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Account Switcher</span> — dropdown เลือกบัญชีที่ต้องการดู ข้อมูลทั้งหมดจะเปลี่ยนตามบัญชี</li>
								<li><span class="text-white font-medium">All Accounts</span> — เลือก "All" เพื่อดูข้อมูลรวมทุกบัญชี</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — เปรียบเทียบบัญชี</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Account Comparison</span> — ตารางเปรียบเทียบ KPI ของแต่ละบัญชี (P&L, Win Rate, PF, Drawdown)</li>
								<li><span class="text-white font-medium">Equity Overlay</span> — กราฟ equity ซ้อนกันเพื่อดู performance ของแต่ละบัญชี</li>
								<li><span class="text-white font-medium">Combined Stats</span> — สถิติรวมทุกบัญชีรวมกัน</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'social'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Social — Leaderboard & Community</h3>
						<p class="text-sm text-gray-400">ดูอันดับ trader, เปรียบเทียบ performance กับคนอื่น, และแชร์ผลงาน</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — Leaderboard</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Rankings</span> — ดูอันดับ trader ตาม P&L, Win Rate, Profit Factor, Consistency</li>
								<li><span class="text-white font-medium">Timeframe</span> — สลับช่วงเวลา: สัปดาห์นี้, เดือนนี้, All-time</li>
								<li><span class="text-white font-medium">Your Rank</span> — เห็นอันดับของตัวเอง highlight ชัดเจน</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — Trader Profiles</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Public Profile</span> — กดชื่อ trader เพื่อดู profile: สถิติ, equity curve, win rate, badges</li>
								<li><span class="text-white font-medium">Follow</span> — ติดตาม trader ที่สนใจเพื่อดูอัปเดตผลงาน</li>
								<li><span class="text-white font-medium">Compare</span> — เทียบ performance ของคุณกับ trader คนอื่น</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Achievements & Badges</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Badges</span> — รับ badge เมื่อทำผลงานถึงเป้า (เช่น 7-Day Streak, 100 Trades Reviewed, Profit Factor 2+)</li>
								<li><span class="text-white font-medium">Share Stats</span> — แชร์สถิติเด่นเป็นรูปภาพสวยๆ ไปลง social media</li>
								<li><span class="text-white font-medium">Privacy</span> — ตั้งค่า privacy เลือกว่าจะแสดงข้อมูลอะไรใน public profile</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'analysis'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Gold Analysis — AI วิเคราะห์ตลาดทอง</h3>
						<p class="text-sm text-gray-400">AI วิเคราะห์ XAUUSD อัตโนมัติ พร้อม bias, key levels, และ trade plan</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">วิเคราะห์ 6 ด้าน</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Market Bias</span> — bullish/bearish + เหตุผล</li>
								<li><span class="text-white font-medium">Liquidity Map</span> — จุด liquidity สำคัญ</li>
								<li><span class="text-white font-medium">Setup Analysis</span> — setup ที่น่าสนใจ</li>
								<li><span class="text-white font-medium">Scenarios</span> — สถานการณ์ที่อาจเกิดขึ้น</li>
								<li><span class="text-white font-medium">Key Levels</span> — ระดับราคาสำคัญ</li>
								<li><span class="text-white font-medium">Trade Plan</span> — แผนเทรดสำเร็จรูป</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">วิธีใช้</div>
							<p class="text-sm text-gray-400">กด <span class="text-white font-medium">Generate</span> เพื่อให้ AI สร้างบทวิเคราะห์ใหม่ — ใช้ข้อมูลข่าว + ราคาปัจจุบัน + trade history ของคุณ</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'ai'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">AI Chat — ผู้ช่วยวิเคราะห์อัจฉริยะ</h3>
						<p class="text-sm text-gray-400">ถาม AI ได้ทุกอย่างเกี่ยวกับพอร์ตของคุณ มีเครื่องมือวิเคราะห์ built-in</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">วิธีใช้</div>
							<p class="text-sm text-gray-400">กดไอคอน <span class="text-white font-medium">AI Chat</span> มุมล่างขวา — พิมพ์คำถาม หรือกด prompt สำเร็จรูป</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">ตัวอย่างคำถาม</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li>"วิเคราะห์ trades XAUUSD เดือนนี้"</li>
								<li>"symbol ไหนทำกำไรมากสุด?"</li>
								<li>"session ไหนที่ฉันเทรดดีที่สุด?"</li>
								<li>"สรุป rule breaks และข้อแนะนำ"</li>
								<li>"เทียบ performance Buy vs Sell"</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">AI Tools (Behind the scenes)</div>
							<p class="text-sm text-gray-400">AI มีเครื่องมือ 8 ตัว: trade history, daily stats, open positions, analytics, journal entries, review context, playbooks, equity snapshots — ดึงข้อมูลมาตอบแบบ data-driven</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'tools'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Tools — เครื่องมือและทางลัด</h3>
						<p class="text-sm text-gray-400">ฟีเจอร์เสริมที่ช่วยให้การใช้งานเร็วขึ้น: Quick Trade Entry, Keyboard Shortcuts, Command Palette, Dashboard Customizer และอื่นๆ</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Quick Trade Entry</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Manual Trade</span> — เพิ่ม trade ด้วยมือ กรอก Symbol, Direction, Lot, Entry/Exit Price, เวลาเปิด/ปิด</li>
								<li><span class="text-white font-medium">Quick Add</span> — ฟอร์มย่อสำหรับบันทึก trade เร็วๆ โดยกรอกแค่ข้อมูลหลัก</li>
								<li><span class="text-white font-medium">ใช้เมื่อไหร่</span> — เมื่อ trade ไม่ได้ sync จาก MT5 อัตโนมัติ หรือต้องการเพิ่ม trade จากแพลตฟอร์มอื่น</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Sync (ซิงค์ข้อมูล)</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Manual Sync</span> — กดปุ่ม Sync เพื่อดึง trades/positions/equity ล่าสุดจาก MT5</li>
								<li><span class="text-white font-medium">Auto Sync</span> — ระบบ sync อัตโนมัติทุกช่วงเวลาที่ตั้งไว้</li>
								<li><span class="text-white font-medium">Sync Status</span> — ดูสถานะ sync ล่าสุด (เวลา, จำนวน trades ใหม่)</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Command Palette</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">เปิด</span> — กด <span class="text-white font-mono">Ctrl+K</span> (Windows) หรือ <span class="text-white font-mono">Cmd+K</span> (Mac)</li>
								<li><span class="text-white font-medium">ค้นหา</span> — พิมพ์ชื่อหน้า, คำสั่ง, หรือ trade เพื่อไปที่นั่นทันที</li>
								<li><span class="text-white font-medium">Quick Actions</span> — เช่น "New Journal", "Sync Trades", "Open AI Chat"</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Keyboard Shortcuts</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-mono">Ctrl/Cmd + K</span> — เปิด Command Palette</li>
								<li><span class="text-white font-mono">Ctrl/Cmd + /</span> — เปิด AI Chat</li>
								<li><span class="text-white font-mono">Ctrl/Cmd + J</span> — ไปหน้า Journal</li>
								<li><span class="text-white font-mono">Ctrl/Cmd + S</span> — Sync trades</li>
								<li><span class="text-white font-mono">?</span> — แสดง shortcuts ทั้งหมด</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Saved Views</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Save</span> — บันทึก filter + sort ที่ใช้บ่อยเป็น View (ตั้งชื่อได้)</li>
								<li><span class="text-white font-medium">Load</span> — กดเลือก Saved View เพื่อเรียกใช้ filter ทันที</li>
								<li><span class="text-white font-medium">Share</span> — แชร์ View ให้คนอื่นใช้ filter เดียวกัน</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Dashboard Customizer</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Widget Layout</span> — ลาก-วาง widgets บน Overview dashboard ปรับตำแหน่งตามใจ</li>
								<li><span class="text-white font-medium">Show/Hide</span> — เลือก widgets ที่ต้องการแสดง ซ่อน widgets ที่ไม่ใช้</li>
								<li><span class="text-white font-medium">Reset</span> — กด Reset เพื่อกลับ layout เริ่มต้น</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Start My Day</div>
							<ul class="mt-1 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Morning Routine</span> — กดปุ่ม "Start My Day" เพื่อเริ่ม flow ประจำวัน</li>
								<li><span class="text-white font-medium">Guided Steps</span> — ระบบพาทำ: ดูผลงานเมื่อวาน → เขียน pre-market plan → ทำ checklist → ดู analysis</li>
								<li><span class="text-white font-medium">Daily Summary</span> — สรุปสิ่งที่ต้องทำวันนี้: trades ที่ยังไม่ review, journal ที่ยังไม่เขียน</li>
							</ul>
						</div>
					</div>
				</div>
			{/if}

			<!-- Tips section -->
			<div class="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
				<div class="text-xs font-semibold text-brand-primary mb-2">Daily Workflow แนะนำ</div>
				<ul class="space-y-1.5 text-sm text-gray-400">
					<li>1. เช้า — กด <span class="text-white">Start My Day</span> หรือเปิด <span class="text-white">Day View</span> ดูวันก่อน → เปิด <span class="text-white">Journal</span> เขียน pre-market plan</li>
					<li>2. ระหว่างวัน — ดู <span class="text-white">Gold Analysis</span> ก่อนเทรด → เข้า <span class="text-white">Live Trade</span> ดู session กับ coach</li>
					<li>3. หลังเทรด — ไป <span class="text-white">Trades</span> รีวิวทุก trade + ใส่ tags + notes → ใช้ <span class="text-white">Trade Replay</span> ทบทวน</li>
					<li>4. ก่อนนอน — เปิด <span class="text-white">Progress</span> check daily checklist + เขียน post-market journal</li>
					<li>5. สัปดาห์ละครั้ง — เปิด <span class="text-white">Reports</span> + <span class="text-white">Calendar</span> วิเคราะห์ภาพรวม + ถาม <span class="text-white">AI Chat</span> + ดู <span class="text-white">Leaderboard</span></li>
				</ul>
			</div>
		</div>
	</div>
	</div>
{/if}
