<script lang="ts">
	import { fly, fade } from 'svelte/transition';

	let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();

	let activeSection = $state('overview');

	const sections = [
		{ id: 'overview', label: 'Overview', icon: '📊' },
		{ id: 'trades', label: 'Trades', icon: '📋' },
		{ id: 'journal', label: 'Journal', icon: '📓' },
		{ id: 'analytics', label: 'Analytics', icon: '📈' },
		{ id: 'playbook', label: 'Playbook', icon: '📘' },
		{ id: 'progress', label: 'Progress', icon: '🎯' },
		{ id: 'analysis', label: 'Gold Analysis', icon: '🥇' }
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
				<p class="text-xs text-gray-500 mt-0.5">เรียนรู้วิธีใช้งานทุกฟีเจอร์แบบ Step-by-Step</p>
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
						<p class="text-sm text-gray-400">หน้าแรกที่แสดงข้อมูลสำคัญทั้งหมดของพอร์ตในที่เดียว</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ดู Metric Cards</div>
							<p class="text-sm text-gray-300">ด้านบนสุดจะเห็น 5 การ์ดหลัก:</p>
							<ul class="mt-2 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Balance</span> — ยอดเงินในบัญชี + จำนวน trades ทั้งหมด</li>
								<li><span class="text-white font-medium">Equity</span> — มูลค่าบัญชีรวม floating P/L</li>
								<li><span class="text-white font-medium">Win Rate</span> — เปอร์เซ็นต์ชนะ พร้อม donut chart + จำนวน W/L</li>
								<li><span class="text-white font-medium">Profit Factor</span> — อัตราส่วน กำไรรวม / ขาดทุนรวม (>1 = ดี)</li>
								<li><span class="text-white font-medium">Expectancy</span> — กำไรเฉลี่ยต่อ trade</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — ดู Charts</div>
							<p class="text-sm text-gray-400">มี 2 กราฟหลัก:</p>
							<ul class="mt-2 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Equity Growth</span> — เส้นกราฟแสดง equity/balance ตามเวลา เลือกช่วง 1D ถึง 1Y ได้</li>
								<li><span class="text-white font-medium">Net Daily P&L</span> — แท่งสีเขียว (กำไร) / แดง (ขาดทุน) รายวัน hover ดู tooltip ได้</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Trading Score</div>
							<p class="text-sm text-gray-300">Radar chart แสดงคะแนนซื้อขายจาก 3 แกน:</p>
							<ul class="mt-2 space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Win %</span> — เปอร์เซ็นต์ชนะ</li>
								<li><span class="text-white font-medium">Profit Factor</span> — อัตราส่วนกำไร/ขาดทุน</li>
								<li><span class="text-white font-medium">Avg Win/Loss</span> — ขนาดเฉลี่ยของ trade ชนะ เทียบกับ trade แพ้</li>
							</ul>
							<p class="mt-2 text-sm text-gray-400">คะแนนรวม 0-100: <span class="text-green-400">70+</span> = ดี, <span class="text-amber-400">40-69</span> = ปานกลาง, <span class="text-red-400">&lt;40</span> = ต้องปรับปรุง</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — Command Center</div>
							<p class="text-sm text-gray-400">แสดงสิ่งที่ต้องทำวันนี้: Day P/L, จำนวน trades, review queue, journal completion และ link ไปหน้า review/journal</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 5 — ส่วนล่าง</div>
							<ul class="space-y-1.5 text-sm text-gray-400">
								<li><span class="text-white font-medium">Setup Performance</span> — สรุป playbook ไหนทำกำไรสูงสุด</li>
								<li><span class="text-white font-medium">Open Positions</span> — ตำแหน่งที่เปิดอยู่ตอนนี้</li>
								<li><span class="text-white font-medium">Trading Calendar</span> — ปฏิทินแสดง P/L สีเขียว/แดงตามวัน เลื่อนดูเดือนก่อนได้</li>
								<li><span class="text-white font-medium">Recent Trades</span> — 8 trades ล่าสุดพร้อม review status</li>
							</ul>
						</div>
					</div>
				</div>

			{:else if activeSection === 'trades'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Trades — กล่องรีวิว</h3>
						<p class="text-sm text-gray-400">ดู trade ทั้งหมด กรองข้อมูล และรีวิวแต่ละ trade อย่างละเอียด</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ใช้ Filter Bar</div>
							<p class="text-sm text-gray-400">กดปุ่ม Filter ด้านบนเพื่อกรอง:</p>
							<ul class="mt-2 space-y-1 text-sm text-gray-400">
								<li>ช่วงวันที่ (From / To)</li>
								<li>Symbol, Direction (Buy/Sell), Session</li>
								<li>สถานะ Review, Playbook, Tags</li>
								<li>มี Notes / Attachments หรือไม่</li>
							</ul>
							<p class="mt-2 text-sm text-gray-400">สามารถ <span class="text-white">Save View</span> เพื่อบันทึก filter ที่ใช้บ่อย</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — เลือก Grouping</div>
							<p class="text-sm text-gray-400">จัดกลุ่ม trade ตาม:</p>
							<ul class="mt-2 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Day</span> — แยกตามวัน</li>
								<li><span class="text-white font-medium">Session</span> — แยกตาม Asian / London / New York</li>
								<li><span class="text-white font-medium">Setup</span> — แยกตาม Playbook หรือ setup tag</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — กดเข้า Trade Detail</div>
							<p class="text-sm text-gray-400">กดที่ Symbol ของ trade เพื่อเข้าหน้ารีวิว:</p>
							<ul class="mt-2 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Tags</span> — เพิ่ม/ลบ tags (setup, mistake, emotion, etc.)</li>
								<li><span class="text-white font-medium">Notes</span> — เขียน note + ให้คะแนน 1-5 ดาว</li>
								<li><span class="text-white font-medium">Review</span> — เลือก Playbook, เหตุผลเข้า/ออก, ข้อผิดพลาด, บทเรียน, คะแนนวินัย</li>
								<li><span class="text-white font-medium">Attachments</span> — แนบลิงก์หรือรูปภาพ (chart screenshot)</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — ดู Related Trades</div>
							<p class="text-sm text-gray-400">ด้านล่างจะแสดง trades ที่เกี่ยวข้อง (Symbol เดียวกัน) และ trades ที่เคยรีวิวแล้วเพื่อเปรียบเทียบ</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'journal'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Journal — สมุดบันทึกประจำวัน</h3>
						<p class="text-sm text-gray-400">บันทึก pre-market plan และ post-market review ทุกวันที่เทรด</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — เลือกวันจากปฏิทิน</div>
							<p class="text-sm text-gray-400">คลิกวันที่ในปฏิทิน — วันที่มี trade จะมีสี (เขียว = กำไร, แดง = ขาดทุน) จุดสีน้ำเงิน = มี journal แล้ว</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — เขียน Pre-Market Notes</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Market Bias</span> — มุมมองตลาดวันนี้ (Bullish / Bearish / Neutral)</li>
								<li><span class="text-white font-medium">Key Levels</span> — ระดับราคาสำคัญที่จับตา</li>
								<li><span class="text-white font-medium">Pre-Market Notes</span> — แผนการเทรดวันนี้</li>
								<li><span class="text-white font-medium">Checklist</span> — รายการตรวจสอบก่อนเทรด</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — เขียน Post-Market Review</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Post-Market Notes</span> — สรุปสิ่งที่เกิดขึ้นวันนี้</li>
								<li><span class="text-white font-medium">Mood</span> — อารมณ์ตอนเทรด</li>
								<li><span class="text-white font-medium">Completion Status</span> — เมื่อเขียนครบ กด "Complete" เพื่อนับ streak</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — ดูสรุป Trades ของวัน</div>
							<p class="text-sm text-gray-400">ด้านล่างจะแสดง trades ที่ปิดในวันที่เลือก พร้อม P/L, review status เพื่อให้เห็นภาพรวมวันนั้น</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'analytics'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Analytics — วิเคราะห์เชิงลึก</h3>
						<p class="text-sm text-gray-400">ดู metrics เชิงลึกเพื่อหาจุดแข็ง/จุดอ่อนของการเทรด</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ใช้ Filter เลือกช่วงเวลา</div>
							<p class="text-sm text-gray-400">กรองข้อมูลตามวันที่, symbol, direction เพื่อเจาะลึกช่วงเวลาที่ต้องการวิเคราะห์</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — อ่าน Risk Metrics</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Sharpe Ratio</span> — ผลตอบแทนต่อความเสี่ยง (>1 = ดี, >2 = ดีมาก)</li>
								<li><span class="text-white font-medium">Sortino Ratio</span> — เหมือน Sharpe แต่คิดเฉพาะ downside risk</li>
								<li><span class="text-white font-medium">Calmar Ratio</span> — ผลตอบแทนต่อ max drawdown</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — ดู Performance Breakdown</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Day of Week</span> — วันไหนเทรดได้ดีที่สุด/แย่ที่สุด</li>
								<li><span class="text-white font-medium">Lot Distribution</span> — ขนาด lot ที่ใช้บ่อย</li>
								<li><span class="text-white font-medium">Holding Time</span> — เทรดสั้น/ยาวแบบไหนกำไรกว่า</li>
								<li><span class="text-white font-medium">Session Stats</span> — Asian / London / NY session ไหนดี</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 4 — ดู Setup & Mistake Analysis</div>
							<p class="text-sm text-gray-400">ดู setup ไหนทำกำไรมากสุด, mistake ไหนเสียเงินมากสุด เพื่อปรับพฤติกรรม</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'playbook'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Playbook — จัดการ Setup</h3>
						<p class="text-sm text-gray-400">สร้างและจัดการ trading setups เพื่อใช้อ้างอิงเมื่อรีวิว trades</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — สร้าง Playbook ใหม่</div>
							<p class="text-sm text-gray-400">กรอกข้อมูล:</p>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Name</span> — ชื่อ setup เช่น "BOS Retest", "FVG Entry"</li>
								<li><span class="text-white font-medium">Description</span> — อธิบายว่า setup นี้คืออะไร</li>
								<li><span class="text-white font-medium">Setup Tag</span> — เลือก tag ที่เกี่ยวข้อง</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — กำหนด Criteria</div>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Entry Criteria</span> — เงื่อนไขเข้า (checklist)</li>
								<li><span class="text-white font-medium">Exit Criteria</span> — เงื่อนไขออก</li>
								<li><span class="text-white font-medium">Risk Rules</span> — กฎจัดการความเสี่ยง</li>
								<li><span class="text-white font-medium">Mistakes to Avoid</span> — ข้อผิดพลาดที่ห้ามทำ</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — ดู Performance</div>
							<p class="text-sm text-gray-400">ด้านล่างจะแสดง Setup Performance — แต่ละ playbook ทำกำไรเท่าไร, win rate เท่าไร, expectancy เท่าไร เพื่อดูว่า setup ไหนทำงานจริง</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'progress'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Progress — ติดตามเป้าหมาย</h3>
						<p class="text-sm text-gray-400">ตั้งเป้าหมายและติดตามความก้าวหน้าในการพัฒนาฝีมือเทรด</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ตั้งเป้าหมาย</div>
							<p class="text-sm text-gray-400">ระบบมี 5 เป้าหมายหลัก:</p>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Review Completion</span> — รีวิว trade ให้ครบ x%</li>
								<li><span class="text-white font-medium">Journal Streak</span> — เขียน journal ติดต่อกัน x วัน</li>
								<li><span class="text-white font-medium">Max Rule Breaks</span> — จำกัดจำนวนครั้งที่ทำผิดกฎ</li>
								<li><span class="text-white font-medium">Profit Factor</span> — ให้ PF ถึงเป้า</li>
								<li><span class="text-white font-medium">Win Rate</span> — ให้ win rate ถึงเป้า</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — ปรับค่าเป้าหมาย</div>
							<p class="text-sm text-gray-400">กดที่ตัวเลขเป้าหมายเพื่อเปลี่ยนค่า — ระบบจะคำนวณ progress bar ให้อัตโนมัติ</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — ติดตาม Progress</div>
							<p class="text-sm text-gray-400">แต่ละเป้าหมายจะแสดง progress bar + ค่าปัจจุบัน vs เป้าหมาย เช็คทุกวันเพื่อดูพัฒนาการ</p>
						</div>
					</div>
				</div>

			{:else if activeSection === 'analysis'}
				<div class="space-y-5">
					<div>
						<h3 class="text-base font-semibold text-white mb-1">Gold Analysis — วิเคราะห์ตลาดทอง</h3>
						<p class="text-sm text-gray-400">AI วิเคราะห์ตลาด XAUUSD อัตโนมัติ พร้อม trade plan</p>
					</div>

					<div class="space-y-4">
						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 1 — ดู Market Analysis</div>
							<p class="text-sm text-gray-400">AI จะสร้างบทวิเคราะห์ที่ประกอบด้วย:</p>
							<ul class="mt-1 space-y-1 text-sm text-gray-400">
								<li><span class="text-white font-medium">Market Bias</span> — มุมมองตลาด bullish/bearish พร้อมเหตุผล</li>
								<li><span class="text-white font-medium">Liquidity Map</span> — จุด liquidity สำคัญ</li>
								<li><span class="text-white font-medium">Setup Analysis</span> — setup ที่น่าสนใจ</li>
								<li><span class="text-white font-medium">Scenarios</span> — สถานการณ์ที่อาจเกิดขึ้น</li>
								<li><span class="text-white font-medium">Key Levels</span> — ระดับราคาสำคัญ</li>
								<li><span class="text-white font-medium">Trade Plan</span> — แผนเทรดสำเร็จรูป</li>
							</ul>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 2 — ใช้ TradingView Chart</div>
							<p class="text-sm text-gray-400">ด้านบนมี TradingView chart แบบ interactive สำหรับดูราคา XAUUSD real-time</p>
						</div>

						<div class="rounded-xl border border-dark-border p-4">
							<div class="text-xs font-semibold text-brand-primary mb-2">Step 3 — Generate Analysis ใหม่</div>
							<p class="text-sm text-gray-400">กดปุ่ม "Generate" เพื่อให้ AI สร้างบทวิเคราะห์ใหม่ล่าสุด — ใช้ข้อมูลข่าว + ราคาปัจจุบัน + trade history ของคุณ</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Tips section -->
			<div class="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
				<div class="text-xs font-semibold text-brand-primary mb-2">Tips สำหรับผู้เริ่มต้น</div>
				<ul class="space-y-1.5 text-sm text-gray-400">
					<li>1. เริ่มจากรีวิว trades ทุกวัน — สร้างนิสัย</li>
					<li>2. เขียน journal ทุกวันที่เทรด — จะเห็น pattern ตัวเอง</li>
					<li>3. สร้าง playbook อย่างน้อย 2-3 setup — เทรดแบบมีระบบ</li>
					<li>4. ใช้ Analytics หาว่า session/วัน/setup ไหนที่เทรดดีที่สุด</li>
					<li>5. ตั้งเป้าหมายใน Progress — ติดตามพัฒนาการ</li>
				</ul>
			</div>
		</div>
	</div>
	</div>
{/if}
