# UI/UX Redesign Plan — ให้คล้าย Tradezella
## วันที่วางแผน: 2026-03-28

> **เป้าหมาย**: ปรับ visual design ให้ดู professional เหมือน Tradezella
> โดย**ไม่เปลี่ยน** brand identity (Gold #C9A84C) และ feature ที่เรามีดีกว่า
> All 6 development phases (features) ✅ เสร็จแล้ว — แผนนี้เป็น **Visual/UX layer เท่านั้น**

---

## สรุปความต่างหลักที่ต้องปรับ

| จุด | Tradezella | IB-Portal ปัจจุบัน | Priority |
|-----|-----------|-------------------|---------|
| Sidebar icons | SVG icons คมชัด | Emoji (📊, 👤) | 🔴 สูง |
| Sidebar default state | Icon-only (~64px) | Wide w-64 | 🔴 สูง |
| Portfolio sub-nav | อยู่ใน sidebar ซ้าย | Tab bar ด้านบน | 🟡 กลาง |
| KPI cards | Donut/Gauge/Bar | ยังต้องตรวจสอบ | 🔴 สูง |
| Trade status badge | `WIN` สีเขียว / `LOSS` สีแดง pill | ยังต้องตรวจสอบ | 🟡 กลาง |
| Table row density | Compact (ข้อมูลเยอะต่อ row) | ต้องตรวจสอบ | 🟡 กลาง |
| Primary action button | "Add Trade" ม่วง ด้านบน sidebar | ไม่มี | 🟡 กลาง |
| Overall spacing | Tight + data-dense | ต้องตรวจสอบ | 🟢 ต่ำ |

---

## Phase A — Sidebar Redesign
**ไฟล์หลัก**: `src/lib/components/layout/Sidebar.svelte`
**เวลาประเมิน**: ครึ่งวัน
**Impact**: มองเห็นผลทั่วทั้ง app ทันที

### สิ่งที่ต้องทำ

#### A1: เปลี่ยน Emoji → SVG Icons
ปัจจุบัน sidebar ใช้ emoji (📊 ✅ 👥 🎓 👤 📈 ➕) ซึ่งดู unpolished
ต้องเปลี่ยนเป็น SVG icons สำหรับทุก nav item:

| Route | Icon ที่ควรใช้ |
|-------|--------------|
| Dashboard | `home` / `layout-dashboard` |
| Day View | `calendar-days` |
| Trade View / Trades | `bar-chart-2` |
| Notebook / Journal | `notebook` |
| Reports / Analytics | `trending-up` |
| Strategies / Playbook | `book-open` |
| Progress Tracker | `activity` |
| Settings | `settings` (มีแล้ว — ✅) |
| Admin: อนุมัติ | `user-check` |
| Admin: Master IBs | `users` |
| Admin: จัดการโค้ช | `graduation-cap` |

#### A2: Default State = Collapsed (Icon-only)
- เปลี่ยน default `collapsed = false` → `collapsed = true`
- Save collapse state ใน localStorage เพื่อ persist ข้าม session
- Width: collapsed = `w-16` (64px), expanded = `w-60` (240px)

#### A3: Portfolio Sub-navigation ใน Sidebar
Tradezella แสดง sub-nav ทุก route ใน sidebar ซ้าย
เมื่อ user อยู่ใน `/portfolio/**` ให้แสดง sub-links:

```
📈 Portfolio
  ├── 🏠 ภาพรวม          /portfolio
  ├── 📅 Day View         /portfolio/day-view
  ├── 📋 Trades           /portfolio/trades
  ├── 📓 Journal          /portfolio/journal
  ├── 📊 Analytics        /portfolio/analytics
  ├── 📚 Playbook         /portfolio/playbook
  ├── 🎯 Progress         /portfolio/progress
  └── 📝 Notebook         /portfolio/notebook
```

เมื่อ collapsed ให้แสดงแค่ icon พร้อม tooltip

#### A4: Primary Action Button
เพิ่มปุ่ม "เริ่มวัน" / "บันทึกเทรด" ที่ด้านบน sidebar (ต่ำกว่า logo)
ใช้ brand-primary color เพื่อ call-to-action ที่ชัดเจน

```svelte
<!-- เมื่อ expanded -->
<button class="btn-primary w-full text-sm py-2 mb-3">
  + เริ่มวัน
</button>
<!-- เมื่อ collapsed -->
<button class="btn-primary w-8 h-8 rounded-full mx-auto">
  +
</button>
```

---

## Phase B — Dashboard KPI Cards Verification & Polish
**ไฟล์หลัก**: `src/routes/portfolio/+page.svelte`, `src/lib/components/shared/MetricCard.svelte`
**เวลาประเมิน**: 1 วัน
**Impact**: First impression ของ dashboard

### KPI Cards ที่ต้องมี (เหมือน Tradezella)

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Net P&L        │ │  Trade Win %    │ │  Profit Factor  │ │  Day Win %      │ │  Avg Win/Loss   │
│  $14,742        │ │  ◉ 31.78%       │ │  ◖ 1.82         │ │  ◉ 57.58%       │ │  ██░░ $964/-247 │
│  ↑ vs yesterday │ │  W:47 / L:101   │ │  gauge arc      │ │  D:19 / L:14    │ │  ratio: 3.90    │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### B1: Net P&L Card
- ตัวเลขใหญ่ font-size 2xl–3xl, bold
- สีเขียว/แดงตาม positive/negative
- Sub-text: total trades count, date range

#### B2: Trade Win % — Donut Chart
- SVG donut (ไม่ใช่ library — เขียน SVG ตรงๆ เพื่อ performance)
- ตัวเลข % ตรงกลาง donut
- ด้านล่าง: `W: 47  L: 101`

```svg
<!-- Donut SVG pattern -->
<svg viewBox="0 0 80 80" class="w-16 h-16">
  <circle cx="40" cy="40" r="30" fill="none" stroke="#262626" stroke-width="8"/>
  <circle cx="40" cy="40" r="30" fill="none" stroke="#22c55e" stroke-width="8"
    stroke-dasharray="{winRate * 188.5} 188.5"
    stroke-linecap="round" transform="rotate(-90 40 40)"/>
  <text x="40" y="45" text-anchor="middle" class="text-xs font-bold fill-white">
    {winRate}%
  </text>
</svg>
```

#### B3: Profit Factor — Circle Gauge (Arc)
- SVG arc gauge (semicircle, 0–3 scale, เขียวที่ >1)
- ตัวเลขใหญ่ตรงกลาง
- สี: < 1.0 = red, 1.0–1.5 = yellow, > 1.5 = green

#### B4: Day Win % — Donut Chart
- เหมือน Trade Win % แต่นับวัน (profitable days / total days)
- ด้านล่าง: `วันชนะ: 19  วันแพ้: 14`

#### B5: Avg Win/Loss — Dual Bar
- Horizontal bar เขียว (avg win) vs แดง (avg loss) เปรียบเทียบ
- ตัวเลขด้านข้าง: `$964` และ `-$247`
- Ratio text: `3.90x`

---

## Phase C — Trade Table Visual Refinement
**ไฟล์หลัก**: `src/routes/portfolio/trades/+page.svelte`, trade list components
**เวลาประเมิน**: ครึ่งวัน
**Impact**: หน้าที่ user เห็นบ่อยที่สุด

### C1: Status Badge
```svelte
<!-- WIN badge -->
<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
  WIN
</span>

<!-- LOSS badge -->
<span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
  LOSS
</span>

<!-- BE badge -->
<span class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/20">
  BE
</span>
```

### C2: Quality Scale Bar (Zella Scale equivalent)
- ปัจจุบัน IB-Portal มี quality score แล้ว (Phase 4)
- ต้องแปลงเป็น visual bar ใน trade table column
- สี gradient: แดง (0) → เหลือง (50) → เขียว (100)

```svelte
<!-- Quality bar column -->
<div class="w-20 h-1.5 rounded-full bg-dark-hover overflow-hidden">
  <div
    class="h-full rounded-full transition-all"
    style="width: {score}%; background: {scoreColor(score)}"
  ></div>
</div>
```

### C3: Row Hover & Density
- `py-2.5` สำหรับ compact rows (ลดจาก py-3 หรือ py-4)
- Hover: `hover:bg-dark-hover/50` subtle highlight
- Striped rows (optional): `even:bg-dark-surface/30`
- Clickable rows: cursor-pointer + right arrow icon ด้านขวา

### C4: Net P&L Cell Color
- Positive: `text-green-400 font-semibold`
- Negative: `text-red-400 font-semibold`
- Zero: `text-gray-400`

---

## Phase D — Typography & Visual Density
**ไฟล์หลัก**: `src/app.css`, `tailwind.config.ts`
**เวลาประเมิน**: ครึ่งวัน
**Impact**: Overall polish / ความ professional

### D1: Card Padding
- Cards ปัจจุบัน: `p-6` (Tailwind default)
- ปรับเป็น `p-4` หรือ `p-5` สำหรับ data cards
- Section headers: `text-xs font-semibold uppercase tracking-wider text-gray-500`

### D2: Table Header Style
```svelte
<!-- ต้องเป็นแบบนี้ทุกตาราง -->
<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
  Symbol
</th>
```

### D3: Metric Value Hierarchy
- Big number: `text-2xl font-bold text-white`
- Label: `text-xs text-gray-500 font-medium uppercase tracking-wide`
- Sub value: `text-sm text-gray-400`

### D4: Empty State Consistency
- ทุก empty state ต้องมี: icon + title + description + action button
- ใช้ `EmptyState.svelte` component ที่มีอยู่แล้ว — ตรวจสอบว่า apply ครบทุกหน้า

---

## Phase E — Top Bar Polish (Optional / Low priority)
**ไฟล์หลัก**: `src/routes/portfolio/+layout.svelte`
**เวลาประเมิน**: ครึ่งวัน

Tradezella มี top bar ที่ clean มาก:
```
[Page Title]                    [Filters ▼] [Date Range ▼] [All Accounts ▼]
```

### E1: Global Filter Bar
- Date range selector ที่ทุกหน้าเข้าถึงได้
- Filters button (เปิด filter drawer)
- Account selector (ถ้า multi-account)

### E2: Breadcrumb Navigation
- แสดง location: `Portfolio > Analytics > Performance`
- ช่วย user รู้ว่าอยู่ที่ไหน

---

## เรียงลำดับการทำ (Recommended)

```
Week 1:
├── Phase A: Sidebar redesign (SVG icons + default collapsed + sub-nav)
└── Phase B: KPI cards verification + donut/gauge components

Week 2:
├── Phase C: Trade table polish (badges + quality bar + density)
└── Phase D: Typography & spacing pass

Week 3 (optional):
└── Phase E: Top bar polish
```

---

## สิ่งที่ **ไม่ควร** เปลี่ยน

1. **Gold color (#C9A84C)** — brand identity ของเรา, Tradezella ใช้ purple เพราะนั่นคือ brand ของเขา
2. **AI Chat Panel** — จุดแข็งที่ Tradezella ไม่มี
3. **Filter System (12 dimensions)** — ดีกว่า Tradezella มาก อย่าลด
4. **Trade Review Scoring** — feature เฉพาะของเรา
5. **Admin/IB Role System** — core B2B differentiator

---

## ไฟล์สำคัญที่ต้องแตะ

| Phase | ไฟล์ |
|-------|------|
| A | `src/lib/components/layout/Sidebar.svelte` |
| A | `src/routes/+layout.svelte` (portfolio layout) |
| B | `src/routes/portfolio/+page.svelte` |
| B | `src/lib/components/shared/MetricCard.svelte` |
| B | `src/lib/components/charts/TradingScoreRadar.svelte` |
| C | `src/routes/portfolio/trades/+page.svelte` |
| C | Trade list/table components |
| D | `src/app.css` |
| D | `tailwind.config.ts` |
