# IB-Portal Development Phases
## แผนพัฒนาอย่างละเอียด — วิเคราะห์จาก Gap Analysis

> สถาปัตยกรรมปัจจุบัน: SvelteKit 5 (Runes) + Supabase + Tailwind CSS
> Routes อยู่ที่: `/src/routes/portfolio/`
> Components อยู่ที่: `/src/lib/components/portfolio/` + `/src/lib/components/charts/`
> Server logic อยู่ที่: `/src/lib/server/portfolio.ts` + `/src/lib/portfolio.ts`

---

## วิเคราะห์สถานะปัจจุบัน

### สิ่งที่เรามีแล้ว (และทำได้ดี)
1. **Trade Explorer** — filter 12 มิติ, grouping, pagination, saved views → ดีกว่า TradeZella
2. **Trade Review System** — structured scoring (setup quality, discipline, execution, confidence) + rule breaks → TradeZella ไม่มี
3. **Journal** — daily journal with mood/energy/discipline/confidence scoring → เทียบเท่า TradeZella
4. **Playbook** — entry/exit criteria, risk rules, mistakes to avoid, example trades → เทียบเท่า
5. **Analytics** — Sharpe, Sortino, Calmar, day-of-week, lot distribution, holding time → เรามีลึกกว่า
6. **AI Chat** — streaming AI with portfolio context tools → TradeZella ไม่มี
7. **Gold Analysis** — AI-powered market analysis → TradeZella ไม่มี
8. **Market News** — categorized feed → TradeZilla ไม่มี (มีแค่ Economic Calendar)
9. **Trading Score Radar** — 3-axis radar chart → มีแล้ว (ต้องเพิ่มแกน)
10. **Progress Goals** — review rate, journal streak, profit factor, win rate targets → มีแล้ว

### สิ่งที่ขาดจริงๆ (จัดกลุ่มตามลักษณะงาน)

**กลุ่ม A: Dashboard ยังไม่สมบูรณ์**
- ขาด KPI cards แบบ visual (donut, gauge, bar)
- ขาด cumulative P&L line chart
- ขาด date range filter บน overview page
- Trading Score Radar มี 3 แกน ควรเป็น 6

**กลุ่ม B: ขาดมุมมองรายวัน/รายสัปดาห์**
- ไม่มี Day View (ดู trades ของวันเดียว + calendar picker)
- ไม่มี Week View (สรุปสัปดาห์ + daily bar chart)

**กลุ่ม C: Reports ยังไม่ครบ**
- ไม่มี Performance page (customizable charts)
- ไม่มี Calendar year view
- ไม่มี Symbol breakdown report
- ไม่มี Compare tool
- ไม่มี Export PDF

**กลุ่ม D: ไม่มีระบบ Insights อัตโนมัติ**
- ไม่มี auto-detect patterns ต่อ trade
- ไม่มี trade quality score (Zella Scale)
- ไม่มี Recaps & Insights สรุปรายสัปดาห์/เดือน

**กลุ่ม E: ขาด Daily Checklist**
- ไม่มี daily checklist (manual + automated rules)
- ไม่มี "Start my day" flow
- ไม่มี progress heatmap
- Progress page มี goals แต่ไม่มี discipline tracking

**กลุ่ม F: Notebook ยังไม่ flexible**
- Journal มีแค่ daily entries ไม่มี folder system
- ไม่มี rich text editor
- ไม่มี search, ไม่มี sessions recap

---

## Phase Overview

```
Phase 1: Dashboard Polish           (กลุ่ม A)
Phase 2: Day & Week View            (กลุ่ม B)
Phase 3: Reports Engine             (กลุ่ม C)
Phase 4: Trade Insights Engine      (กลุ่ม D)
Phase 5: Discipline & Checklist     (กลุ่ม E)
Phase 6: Notebook Evolution         (กลุ่ม F)
```

---

## Phase 1: Dashboard Polish

### เป้าหมาย
ยกระดับ Overview page ให้แสดงข้อมูลครบและสวยงามระดับ production

### 1.1 KPI Cards Row

**ตำแหน่ง**: แทรกด้านบนของ Overview page (ก่อน Command Center)

**ต้องสร้าง 5 cards**:

| Card | ค่า | Visualization | คำนวณจาก |
|------|-----|---------------|----------|
| Net P&L | $14,742 | ตัวเลขใหญ่ + copy button + % change | `SUM(profit)` จาก trades |
| Trade Win % | 31.78% | Mini donut chart (win/loss/BE) | `wins / total * 100` |
| Profit Factor | 1.82 | Semi-circle gauge | `SUM(winning) / ABS(SUM(losing))` |
| Day Win % | 57.58% | Mini donut chart | `profitable_days / trading_days * 100` |
| Avg Win/Loss | 3.90 | Dual bar (green/red) | `AVG(winning_profit) / ABS(AVG(losing_profit))` |

**Architecture Notes**:
- ข้อมูลคำนวณใน `+page.server.ts` (มีอยู่บางส่วนแล้วใน `buildReportExplorer`)
- เพิ่ม fields ใหม่: `dayWinRate`, `avgWin`, `avgLoss` ใน server response
- Component ใหม่: `KpiCardsRow.svelte` รวม 5 cards
- Sub-components: `MiniDonut.svelte`, `SemiGauge.svelte`, `DualBar.svelte`

**ไฟล์ที่แก้**:
```
แก้ไข:
  src/routes/portfolio/+page.server.ts     → เพิ่ม KPI calculations
  src/routes/portfolio/+page.svelte        → เพิ่ม KpiCardsRow

สร้างใหม่:
  src/lib/components/charts/KpiCardsRow.svelte
  src/lib/components/charts/MiniDonut.svelte
  src/lib/components/charts/SemiGauge.svelte
  src/lib/components/charts/DualBar.svelte
```

### 1.2 Cumulative P&L Chart

**ตำแหน่ง**: เพิ่มเป็น tab/section ถัดจาก DailyPnlChart ที่มีอยู่

**Implementation**:
- ใช้ lightweight-charts (มีอยู่แล้ว) สร้าง area chart
- Data: cumulative sum ของ daily P&L จาก `daily_stats`
- Timeframe selector: 1M / 3M / 6M / 1Y / All

**ไฟล์ที่แก้**:
```
สร้างใหม่:
  src/lib/components/charts/CumulativePnlChart.svelte

แก้ไข:
  src/routes/portfolio/+page.svelte  → เพิ่ม chart section
```

### 1.3 Date Range Filter on Overview

**ปัจจุบัน**: Overview page ไม่มี date filter (Trades page มี)
**เป้าหมาย**: เพิ่ม date range picker ที่ top bar ของ Overview

**Implementation**:
- Reuse date filter logic จาก `PortfolioFilterBar.svelte` (มีอยู่แล้ว)
- สร้าง lightweight `DateRangeSelect.svelte` สำหรับ overview
- เมื่อเปลี่ยน date → re-load KPIs + charts ผ่าน URL search params (pattern เดียวกับ Trades page)

**ไฟล์ที่แก้**:
```
สร้างใหม่:
  src/lib/components/ui/DateRangeSelect.svelte

แก้ไข:
  src/routes/portfolio/+page.server.ts  → รับ from/to params
  src/routes/portfolio/+page.svelte     → เพิ่ม DateRangeSelect ที่ header
```

### 1.4 Trading Score Radar — 6 Axes

**ปัจจุบัน**: `TradingScoreRadar.svelte` มี 3 แกน (win_rate, profit_factor, avg_win_loss)
**เป้าหมาย**: เพิ่มเป็น 6 แกน

| แกนใหม่ | คำนวณ | ที่มาข้อมูล |
|---------|--------|------------|
| Recovery Factor | Net P&L / Max Drawdown | `daily_stats` → หา max drawdown |
| Max Drawdown Score | Inverted: ยิ่ง DD น้อย ยิ่งคะแนนสูง | `equity_snapshots` → consecutive decline |
| Consistency | 1 - (StdDev(daily P&L) / Mean(daily P&L)) | `daily_stats` |

**ไฟล์ที่แก้**:
```
แก้ไข:
  src/lib/components/charts/TradingScoreRadar.svelte  → เพิ่ม 3 แกน
  src/lib/server/portfolio.ts  → เพิ่ม calcRecoveryFactor, calcConsistency
  src/routes/portfolio/+page.server.ts  → ส่ง data ใหม่ไป
```

### Phase 1 Database Changes
**ไม่ต้อง** — ใช้ tables ที่มีอยู่แล้ว (`trades`, `daily_stats`, `equity_snapshots`)

### Phase 1 Definition of Done
- [ ] KPI cards แสดงถูกต้อง + มี loading skeleton + empty state
- [ ] Donut/Gauge animations ลื่นไหล
- [ ] Cumulative P&L chart interactive (hover = tooltip)
- [ ] Date range filter ทำงานร่วมกับทุก KPI + chart
- [ ] Radar 6 แกนแสดงถูกต้อง + tooltip อธิบายแต่ละแกน
- [ ] Mobile responsive ทุก component
- [ ] Performance: Overview load < 2 วินาที

---

## Phase 2: Day & Week View

### เป้าหมาย
สร้างหน้า Day View ที่ trader ใช้ดู daily performance ได้เร็ว + Week View สรุปรายสัปดาห์

### 2.1 Route & Navigation

**เพิ่ม tab ใหม่ใน Portfolio layout**:

ปัจจุบัน: `Overview | Trades | Journal | Analytics | Playbook | Progress | Live | Gold`
เพิ่ม: `Overview | **Day View** | Trades | Journal | Analytics | Playbook | Progress | Live | Gold`

**Route**: `/portfolio/day-view`

### 2.2 Day View Component

```
Layout:
┌─────────────────────────────────────────────────────────┐
│  Day View          [Day] [Week]    Date range  Filters  │
│─────────────────────────────────────────────────────────│
│                                                          │
│  ┌── Main Content (75%) ───┐  ┌── Calendar (25%) ──┐   │
│  │                          │  │   March 2026       │   │
│  │  March 15, 2026          │  │   Su Mo Tu We ...  │   │
│  │  Daily Summary Card      │  │    1  2  3  4  5   │   │
│  │  ┌────────────────────┐  │  │   ...              │   │
│  │  │ P&L  Trades  WR    │  │  │   15 ← selected   │   │
│  │  │+$610  3    66%     │  │  │                    │   │
│  │  └────────────────────┘  │  │ Days with trades   │   │
│  │                          │  │ are highlighted     │   │
│  │  Trade List              │  │ green=profit        │   │
│  │  ┌────────────────────┐  │  │ red=loss            │   │
│  │  │ 09:15 XAUUSD BUY   │  │  └────────────────────┘   │
│  │  │ 10:30 EURUSD SELL  │  │                            │
│  │  │ 14:22 XAUUSD SELL  │  │                            │
│  │  └────────────────────┘  │                            │
│  └──────────────────────────┘                            │
└──────────────────────────────────────────────────────────┘
```

**Data Loading**:
- `+page.server.ts`: query trades WHERE date = selectedDate
- Calendar data: query daily_stats for current month → highlight days
- Click day in calendar → goto(`/portfolio/day-view?date=2026-03-15`)

**Existing Code Reuse**:
- `MiniCalendar.svelte` → ปรับเพิ่ม P&L color coding (มีอยู่แล้วบางส่วน)
- Trade list → reuse trade row pattern จาก trades page
- Filter system → reuse `parsePortfolioFilters` + `applyPortfolioFilters`

### 2.3 Week View Component

```
Layout:
┌──────────────────────────────────────────────────────────────┐
│  Week View                                                     │
│  ◀ Jun 23 - Jun 29, 2024 ▶       Net P&L: +$672.97           │
│────────────────────────────────────────────────────────────────│
│                                                                │
│  ┌── Day Cards ──────────────────────────────────────────┐    │
│  │ Sun 23 │ Mon 24  │ Tue 25  │ Wed 26  │ Thu 27 │ Fri 28│   │
│  │        │ +$225   │ +$300   │ -$37.5  │        │ +$185 │   │
│  │ no     │ 3 Tr    │ 3 Tr    │ 2 Tr    │ no     │ 2 Tr  │   │
│  │ trades │ 🟢      │ 🟢      │ 🔴      │ trades │ 🟢    │   │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌── Week Stats ─────────────────────────────────────────┐    │
│  │ Total Trades │ Win Rate │ Gross P&L │ Profit Factor   │    │
│  │     10       │   40%    │ +$687.50  │    1.40         │    │
│  │ Volume       │ Winners  │ Losers    │ Commissions     │    │
│  │     251      │   4      │   6       │    $14.30       │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌── Daily P&L Bar Chart ────────────────────────────────┐    │
│  │        ██                                              │    │
│  │   ██   ██            ██                                │    │
│  │   ██   ██       ██   ██                                │    │
│  │ ───────────────────────                                │    │
│  │   Su  Mo  Tu  We  Th  Fr  Sa                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌── Trade List ─────────────────────────────────────────┐    │
│  │ Day         │ Time    │ Symbol │ Side │ Net P&L       │    │
│  │ Fri, Jun 28 │ 12:23   │ AAPL   │ BUY  │ +$7.89       │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Data Loading**:
- Query trades WHERE date BETWEEN weekStart AND weekEnd
- Group by day → calculate per-day stats
- Calculate week aggregate stats

**Server Function** (เพิ่มใน `portfolio.ts`):
```typescript
function buildWeekSummary(trades: Trade[], weekStart: Date, weekEnd: Date) {
  // Group trades by day
  // Calculate: totalTrades, winRate, grossPnl, profitFactor, volume, commissions
  // Build daily P&L array for bar chart
  return { dayCards, weekStats, dailyPnl, trades }
}
```

### ไฟล์ทั้งหมด Phase 2
```
สร้างใหม่:
  src/routes/portfolio/day-view/
    ├── +page.server.ts
    └── +page.svelte
  src/lib/components/portfolio/DayViewCalendar.svelte
  src/lib/components/portfolio/DaySummaryCard.svelte
  src/lib/components/portfolio/WeekDayCards.svelte
  src/lib/components/portfolio/WeekStatsGrid.svelte
  src/lib/components/charts/WeeklyPnlBar.svelte

แก้ไข:
  src/routes/portfolio/+layout.svelte  → เพิ่ม "Day View" tab
  src/lib/server/portfolio.ts          → เพิ่ม buildWeekSummary()
  src/lib/components/portfolio/MiniCalendar.svelte → เพิ่ม P&L coloring
```

### Phase 2 Database Changes
**ไม่ต้อง** — ใช้ `trades` + `daily_stats` ที่มีอยู่

### Phase 2 Definition of Done
- [ ] Day View แสดง trades ของวันที่เลือก + daily summary
- [ ] Calendar highlight วันที่มี trades (สีเขียว/แดง)
- [ ] Click วัน → โหลด trades ของวันนั้น (ไม่ full page reload, ใช้ goto)
- [ ] Week View แสดง 7 day cards + week stats + bar chart
- [ ] ◀ ▶ navigation เปลี่ยนสัปดาห์
- [ ] Day/Week toggle smooth (ไม่กระตุก)
- [ ] Keyboard: ← → เปลี่ยนวัน/สัปดาห์
- [ ] URL state: `/portfolio/day-view?date=2026-03-15&view=week`
- [ ] Mobile: cards stack vertically, calendar อยู่ด้านบน

---

## Phase 3: Reports Engine

### เป้าหมาย
สร้างระบบ Reports ที่ customizable — trader เลือกดู performance ได้หลายมุมมอง

### 3.1 Route Structure

**เพิ่ม sub-routes ใต้ portfolio**:

ปัจจุบัน Analytics page มีอยู่แล้ว → ยกระดับเป็น Reports section ที่ครบถ้วน

```
/portfolio/analytics                → เปลี่ยนชื่อ tab เป็น "Reports"
/portfolio/analytics/performance    → ใหม่
/portfolio/analytics/calendar       → ใหม่
/portfolio/analytics/symbols        → ใหม่
/portfolio/analytics/compare        → ใหม่
```

**หรืออีกแนวทาง**: เพิ่ม sub-tabs ภายใน Analytics page ที่มีอยู่แล้ว (ไม่ต้องสร้าง route ใหม่)

**เลือกแนวทาง 2** — เพิ่ม sub-tabs ใน analytics page:
- ดีกว่าเพราะ: ใช้ data loading ชุดเดียวกับ `buildReportExplorer()` ที่มีอยู่
- ไม่ต้องเปลี่ยน layout navigation
- User ไม่สับสนกับ route ใหม่

```
Reports tab:
  [Overview] [Performance] [Calendar] [Symbols] [Compare]
     ↑ หน้า Analytics ปัจจุบัน (เปลี่ยนชื่อเป็น Overview)
```

### 3.2 Performance Sub-tab

**สิ่งที่ต้องสร้าง**:
- Dual chart area — ซ้ายและขวา
- แต่ละ chart มี: metric selector (dropdown) + timeframe toggle (Day/Week/Month)
- Available metrics: Net P&L (cumulative), Net P&L (per period), Win Rate, Profit Factor, Trade Count, Avg Win/Loss

**Configurable Chart Component**:
```svelte
<ConfigurableChart
  data={trades}
  defaultMetric="net_pnl_cumulative"
  defaultTimeframe="day"
  availableMetrics={[
    { key: 'net_pnl_cumulative', label: 'Net P&L (Cumulative)' },
    { key: 'net_pnl', label: 'Net P&L' },
    { key: 'win_rate', label: 'Win Rate %' },
    { key: 'profit_factor', label: 'Profit Factor' },
    { key: 'trade_count', label: 'Trade Count' },
    { key: 'avg_win_loss', label: 'Avg Win/Loss' },
  ]}
/>
```

**Data processing** (server-side):
- Group trades by timeframe (day/week/month)
- Calculate selected metric per group
- Return as time series for chart

### 3.3 Calendar Sub-tab (Year View)

**สิ่งที่ต้องสร้าง**:
- 12-month calendar grid (4 columns × 3 rows)
- Each day cell: colored by P&L intensity
- Color scale: deep red (-$500+) → light red → gray (0) → light green → deep green (+$500+)
- Click day → popup with daily summary

**Data**:
- Query: `SELECT date, SUM(profit) FROM trades WHERE YEAR = ? GROUP BY date`
- ใช้ `daily_stats` ที่มีอยู่ (มี date + profit อยู่แล้ว)

**Component**: `YearCalendar.svelte`
- Props: `year: number`, `dailyPnl: Map<string, number>`
- Render: 12 `MonthGrid` components
- Interaction: click day → show `DaySummaryPopover`

### 3.4 Symbols Sub-tab

**สิ่งที่ต้องสร้าง**:
- Symbol performance table (sortable)
- Symbol P&L bar chart (top 10)

**Table Columns**:
| Symbol | Trades | Wins | Losses | Win Rate | Profit Factor | Net P&L | Avg P&L |
|--------|--------|------|--------|----------|---------------|---------|---------|

**Data** (server-side, เพิ่มใน `buildReportExplorer`):
```typescript
function buildSymbolBreakdown(trades: Trade[]) {
  const bySymbol = groupBy(trades, 'symbol');
  return Object.entries(bySymbol).map(([symbol, symbolTrades]) => ({
    symbol,
    trades: symbolTrades.length,
    wins: symbolTrades.filter(t => t.profit > 0).length,
    losses: symbolTrades.filter(t => t.profit < 0).length,
    winRate: ...,
    profitFactor: ...,
    netPnl: ...,
    avgPnl: ...,
  }));
}
```

**Interaction**: Click row → filter trades page by that symbol (reuse existing filter system)

### 3.5 Compare Sub-tab

**สิ่งที่ต้องสร้าง**:
- 2 filter panels side by side
- "Generate Report" button → show comparison table
- Each panel: Symbol picker, Side selector, Date range, Tag selector

**Data flow**:
1. User fills Group 1 + Group 2 filters
2. Click "Generate Report"
3. Server: filter trades for each group → calculate metrics for each → diff
4. Display comparison table with highlight (which group is better)

**Reuse**: ใช้ `applyPortfolioFilters()` ที่มีอยู่แล้ว — เรียก 2 ครั้งกับ 2 filter sets

### 3.6 Export PDF

**Implementation**:
- ใช้ client-side: `html2canvas` + `jspdf`
- ปุ่ม "Export PDF" ที่มุมขวาบนของ reports
- Capture current view → สร้าง PDF พร้อม header (account info + date range)

### ไฟล์ทั้งหมด Phase 3
```
สร้างใหม่:
  src/lib/components/reports/
    ├── ReportsSubNav.svelte         (sub-tab navigation)
    ├── PerformanceView.svelte       (dual configurable charts)
    ├── ConfigurableChart.svelte     (reusable metric chart)
    ├── MetricSelector.svelte        (dropdown + timeframe toggle)
    ├── YearCalendar.svelte          (12-month grid)
    ├── MonthGrid.svelte             (single month cells)
    ├── DaySummaryPopover.svelte     (click-day popup)
    ├── SymbolTable.svelte           (sortable symbol breakdown)
    ├── SymbolPnlChart.svelte        (horizontal bar chart)
    ├── ComparePanel.svelte          (2-group filter + compare results)
    └── ExportPdfButton.svelte       (html2canvas + jspdf)

แก้ไข:
  src/routes/portfolio/analytics/+page.svelte      → เพิ่ม sub-tabs
  src/routes/portfolio/analytics/+page.server.ts   → เพิ่ม symbol breakdown data
  src/lib/server/portfolio.ts                       → เพิ่ม buildSymbolBreakdown()
```

### Phase 3 Database Changes
**ไม่ต้อง**

### Phase 3 Definition of Done
- [ ] Performance: dual charts ทำงาน + เลือก metric/timeframe ได้
- [ ] Calendar: 12 เดือนแสดงสี P&L ถูกต้อง + click day popup
- [ ] Symbols: table sortable + click row filter ทำงาน
- [ ] Compare: 2 groups comparison ถูกต้อง + highlight better group
- [ ] Export PDF: capture สวยงาม + includes header info
- [ ] Sub-tab navigation smooth ไม่ reload data
- [ ] All views respect current date range filter from parent
- [ ] Mobile: tables scroll horizontally, charts resize

---

## Phase 4: Trade Insights Engine

### เป้าหมาย
ทำให้ app "ฉลาด" — วิเคราะห์ trade อัตโนมัติและให้ feedback ที่ actionable

### 4.1 Architecture Design

```
Trade Sync → [Insights Engine] → trade_insights table → UI Display
                    ↓
           [Quality Score Calculator] → trades.quality_score → UI Display
```

**When insights run**:
- หลัง MT5 sync เสร็จ (new trades arrive)
- เมื่อ user request manual recalculate
- Background job (optional, ทำทีหลัง)

**Engine Design**:
```
src/lib/server/insights/
  ├── engine.ts              ← main orchestrator
  ├── types.ts               ← interfaces
  ├── rules/                 ← individual rules (1 file per rule)
  │   ├── no-drawdown.ts
  │   ├── green-to-red.ts
  │   ├── red-to-green.ts
  │   ├── exceed-avg-profit.ts
  │   ├── exceed-avg-hold.ts
  │   ├── drawdown-exceed-profit.ts
  │   ├── loss-streak.ts
  │   ├── loser-long-hold.ts
  │   ├── scale-in.ts
  │   └── scale-out.ts
  └── quality-score.ts       ← composite score calculator
```

### 4.2 Insight Rules (10 rules เริ่มต้น)

#### Rule 1: No Drawdown (Positive 🟢)
```
เงื่อนไข: trade ที่ไม่เคยมี floating loss (open P&L >= 0 ตลอด)
ข้อจำกัด: ต้องมี equity_snapshots หรือ trade chart context
ข้อความ: "Perfect entry — this trade never went into drawdown"
ประโยชน์: เรียนรู้ว่า entry timing ดีตอนไหน
```

#### Rule 2: Green to Red (Negative 🔴)
```
เงื่อนไข: trade ที่เคยมี floating profit > X% แต่ปิดขาดทุน
ข้อจำกัด: ต้องมี chart context data
ข้อความ: "This trade was up $X but closed at -$Y. Consider taking partial profit earlier"
ประโยชน์: ช่วยตัดสินใจ take profit
```

#### Rule 3: Red to Green (Positive 🟢)
```
เงื่อนไข: trade ที่เคยมี floating loss > X% แต่ปิด profit
ข้อความ: "Strong recovery — started -$X but closed +$Y"
ประโยชน์: วิเคราะห์ patience vs hope
```

#### Rule 4: Exceeded Average Profit (Positive 🟢)
```
เงื่อนไข: trade profit > AVG(profit) ของ symbol เดียวกัน × 1.5
ข้อความ: "Above average — $X profit vs $Y average for {symbol}"
```

#### Rule 5: Exceeded Average Hold Time (Warning 🟡)
```
เงื่อนไข: hold duration > AVG(duration) ของ symbol เดียวกัน × 2
ข้อความ: "Held {duration} vs average {avg_duration} for {symbol}"
```

#### Rule 6: Drawdown Exceeded Final Profit (Warning 🟡)
```
เงื่อนไข: max floating loss > final profit (trade won แต่ drawdown มาก)
ข้อความ: "Risk was high — drawdown $X exceeded final profit $Y"
```

#### Rule 7: Loss Streak Short Gap (Negative 🔴)
```
เงื่อนไข: 3+ losing trades ภายใน 30 นาที (revenge trading signal)
ข้อความ: "3 consecutive losses in 30 minutes — possible revenge trading"
```

#### Rule 8: Loser Long Hold (Negative 🔴)
```
เงื่อนไข: losing trade ที่ hold นานกว่า avg losing trade × 2
ข้อความ: "Held losing trade {duration} — avg losing hold is {avg}"
```

#### Rule 9: Scale In Detected (Info 🔵)
```
เงื่อนไข: multiple positions opened ใน symbol เดียวกัน ในเวลาใกล้กัน same direction
ข้อความ: "Scaled into {symbol} with {n} entries"
```

#### Rule 10: Scale Out Detected (Info 🔵)
```
เงื่อนไข: partial close detected (lot size ลดลงก่อน final close)
ข้อความ: "Scaled out of {symbol} in {n} steps"
```

### 4.3 Trade Quality Score

คำนวณ 0-100 ต่อ trade:

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Risk Management | 35% | มี SL? Drawdown controlled? SL distance reasonable? |
| Execution | 25% | Hold time appropriate? Entry timing? |
| Review Completion | 20% | มี review? มี notes? linked to playbook? |
| Outcome Relative | 20% | P&L relative to avg trade for this symbol |

**แสดงเป็น**: gradient bar (แดง 0-30, ส้ม 30-50, เหลือง 50-70, เขียว 70-100)

### 4.4 UI Integration

**Trade View table** — เพิ่ม 2 columns:
- "Insights" — badge แสดงจำนวน insights (เช่น "3")
- "Quality" — gradient bar 0-100

**Trade Detail page** — เพิ่ม section:
- "Trade Insights" card แสดงรายการ insights พร้อม icon สีและข้อความ

### ไฟล์ทั้งหมด Phase 4
```
สร้างใหม่:
  src/lib/server/insights/
    ├── engine.ts
    ├── types.ts
    ├── quality-score.ts
    └── rules/
        ├── no-drawdown.ts
        ├── green-to-red.ts
        ├── red-to-green.ts
        ├── exceed-avg-profit.ts
        ├── exceed-avg-hold.ts
        ├── drawdown-exceed-profit.ts
        ├── loss-streak.ts
        ├── loser-long-hold.ts
        ├── scale-in.ts
        └── scale-out.ts

  src/lib/components/portfolio/
    ├── InsightBadge.svelte
    ├── InsightCard.svelte
    ├── QualityScoreBar.svelte
    └── InsightsSection.svelte

  src/routes/api/portfolio/insights/+server.ts  (trigger recalculation)

สร้าง Migration:
  supabase/migrations/XXXX_add_trade_insights.sql
```

### Phase 4 Database Changes
```sql
-- Migration: add_trade_insights.sql

CREATE TABLE trade_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  trade_id UUID NOT NULL,
  rule_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('positive', 'negative', 'warning', 'info')),
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trade_id, rule_id)
);

ALTER TABLE trade_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own insights" ON trade_insights
  FOR SELECT USING (
    account_id IN (SELECT id FROM client_accounts WHERE user_id = auth.uid())
  );

CREATE INDEX idx_trade_insights_trade ON trade_insights(trade_id);
CREATE INDEX idx_trade_insights_account ON trade_insights(account_id);

-- Add quality_score to trades (or a separate table)
-- Option: use trade_insights aggregate instead of storing on trades
```

### Phase 4 Definition of Done
- [ ] 10 insight rules evaluate correctly
- [ ] Insights appear in Trade View table as badge
- [ ] Insights appear in Trade Detail page as cards
- [ ] Quality score calculates 0-100 and displays as gradient bar
- [ ] Insights recompute after sync
- [ ] No false positives (rules are conservative)
- [ ] Performance: insight calculation < 5 seconds for 1000 trades
- [ ] Each insight has actionable message (not just observation)

---

## Phase 5: Discipline & Checklist System

### เป้าหมาย
ช่วย trader สร้าง trading discipline ผ่าน daily routine tracking

### 5.1 Daily Checklist System

**สิ่งที่ต้องสร้าง**:

```
┌─ Daily Checklist (Dashboard Widget) ──────────────────┐
│                                                         │
│ ☑ MANUAL RULES                                         │
│ ✅ Review market structure before trading                │
│ ☐ Set daily loss limit                                  │
│                                                         │
│ 🤖 AUTOMATED RULES                                     │
│ ✅ All trades have stop loss           100% ✓           │
│ ⏳ Journal completed                    Not yet          │
│ ✅ Max loss per trade < $100           $45 best ✓       │
│                                                         │
│ Progress: 3/5  ██████░░░░                               │
└─────────────────────────────────────────────────────────┘
```

**Rule Types**:

| Type | ตัวอย่าง | Evaluation |
|------|---------|-----------|
| Manual | "Meditate before trading" | User check/uncheck |
| Auto: trades_have_sl | "All trades have SL" | `trades.filter(t => t.sl > 0).length / trades.length` |
| Auto: journal_complete | "Journal completed" | `daily_journal WHERE date = today AND completion_status = 'complete'` |
| Auto: max_loss_trade | "Max loss per trade < $X" | `MIN(profit) >= -X` |
| Auto: max_loss_day | "Max loss per day < $X" | `SUM(profit) >= -X` |
| Auto: trades_linked_playbook | "Link trades to playbook" | `trades.filter(t => t.playbook_id).length / trades.length` |

### 5.2 "Start My Day" Flow

**ปุ่ม "Start My Day"** บน Overview + Day View:
1. Click → modal เปิดแสดง today's checklist
2. User ✓ manual items
3. ดู automated items status
4. Close → save checklist state + timestamp

**Integration**: เพิ่มใน Command Center ที่มีอยู่แล้วบน Overview page

### 5.3 Progress Heatmap

**เพิ่มใน Progress page** (มีอยู่แล้ว):

```
ปัจจุบัน Progress page มี:
  - Goals list with progress bars

เพิ่ม:
  - Heatmap widget (weekly grid, 10 weeks)
  - Current streak counter
  - Daily completion score gauge
```

**Heatmap Data**:
- Query `checklist_completions` GROUP BY date
- Intensity = completion_rate (0-100%)

### ไฟล์ทั้งหมด Phase 5
```
สร้างใหม่:
  src/lib/components/portfolio/
    ├── DailyChecklist.svelte
    ├── ChecklistRuleItem.svelte
    ├── StartMyDayModal.svelte
    ├── ProgressHeatmap.svelte
    └── StreakCounter.svelte

  src/lib/server/checklist.ts          (evaluate automated rules)

  src/routes/api/portfolio/checklist/
    ├── +server.ts                      (CRUD rules)
    └── complete/+server.ts             (mark completion)

สร้าง Migration:
  supabase/migrations/XXXX_add_checklist_system.sql

แก้ไข:
  src/routes/portfolio/+page.svelte           → เพิ่ม checklist widget + Start My Day
  src/routes/portfolio/progress/+page.svelte  → เพิ่ม heatmap + streak
  src/routes/portfolio/progress/+page.server.ts → load checklist data
```

### Phase 5 Database Changes
```sql
-- Migration: add_checklist_system.sql

CREATE TABLE checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('manual', 'automated')),
  automated_check TEXT,  -- 'trades_have_sl', 'journal_complete', etc.
  condition JSONB,       -- {"threshold": 100, "unit": "percent"} or {"max": 100, "unit": "usd"}
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  rule_id UUID REFERENCES checklist_rules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  auto_value NUMERIC,        -- actual value for automated rules
  completed_at TIMESTAMPTZ,
  UNIQUE(rule_id, date)
);

CREATE TABLE daily_starts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  date DATE NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL
);

-- RLS policies
ALTER TABLE checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_starts ENABLE ROW LEVEL SECURITY;

-- (policies similar to existing tables)

CREATE INDEX idx_checklist_completions_date ON checklist_completions(account_id, date);
CREATE INDEX idx_daily_starts_date ON daily_starts(account_id, date);
```

### Phase 5 Definition of Done
- [ ] Checklist แสดงบน Overview dashboard
- [ ] Manual rules check/uncheck + persist ทันที
- [ ] Automated rules evaluate real-time
- [ ] "Start My Day" modal ทำงาน + save timestamp
- [ ] Heatmap แสดงบน Progress page + intensity ถูกต้อง
- [ ] Streak counter นับวันต่อเนื่องถูกต้อง (skip weekends optional)
- [ ] Default rules สร้างอัตโนมัติเมื่อเปิดใช้ครั้งแรก
- [ ] Edit rules UI: add/remove/reorder rules

---

## Phase 6: Notebook Evolution

### เป้าหมาย
ยกระดับ Journal เป็น Notebook ที่ flexible — folders, rich text, search, sessions

### 6.1 Notebook Architecture

**ไม่ทำลายสิ่งที่มีอยู่**: Daily Journal ที่มีอยู่ยังทำงานเหมือนเดิม
**เพิ่ม**: Notebook system ที่ wrap journal + เพิ่ม flexibility

```
Notebook (Tab ใหม่ หรือ Sub-section ของ Journal)
  ├── All Notes (aggregate view)
  ├── Daily Journal (= journal ที่มีอยู่เดิม)
  ├── Trade Notes (auto-collected จาก trade reviews)
  ├── Sessions Recap (Asian / London / New York)
  ├── My Notes (custom folders)
  └── Recently Deleted (soft delete)
```

### 6.2 Rich Text Editor

**เลือก library**: `tiptap` (Svelte compatible, lightweight, extensible)

Features:
- Bold, Italic, Strikethrough
- Headings (H1, H2, H3)
- Bullet list, Numbered list
- Code block
- Link
- Image (paste/upload)
- Table (optional, Phase 2)

**Integration**: แทนที่ textarea ใน journal editor ด้วย tiptap editor

### 6.3 Search

**Full-text search** ข้าม notes ทุกประเภท:
- ใช้ PostgreSQL `to_tsvector` + `ts_query` (Supabase รองรับ)
- Search bar ที่ top ของ Notebook
- Results: highlight matching text + link ไปที่ note

### ไฟล์ทั้งหมด Phase 6
```
สร้างใหม่:
  src/routes/portfolio/notebook/
    ├── +page.server.ts
    └── +page.svelte

  src/lib/components/notebook/
    ├── NotebookLayout.svelte      (sidebar + content area)
    ├── FolderSidebar.svelte       (folder list)
    ├── NoteList.svelte            (notes in folder)
    ├── NoteEditor.svelte          (tiptap rich text)
    └── NoteSearch.svelte          (search bar + results)

  src/routes/api/portfolio/notebook/
    ├── +server.ts                  (CRUD notes)
    └── folders/+server.ts         (CRUD folders)

สร้าง Migration:
  supabase/migrations/XXXX_add_notebook.sql

แก้ไข:
  src/routes/portfolio/+layout.svelte  → เพิ่ม "Notebook" tab
```

### Phase 6 Database Changes
```sql
-- Migration: add_notebook.sql

CREATE TABLE notebook_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('system', 'custom')),
  system_type TEXT, -- 'all', 'daily_journal', 'trade_notes', 'sessions', 'recently_deleted'
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notebook_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  folder_id UUID REFERENCES notebook_folders(id),
  title TEXT,
  content TEXT,                    -- HTML from tiptap
  content_plain TEXT,              -- plain text for search
  linked_trade_id UUID,
  linked_date DATE,
  linked_session TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index
CREATE INDEX idx_notebook_search ON notebook_notes
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_plain, '')));

-- RLS
ALTER TABLE notebook_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_notes ENABLE ROW LEVEL SECURITY;
```

### Phase 6 Definition of Done
- [ ] Notebook page with folder sidebar
- [ ] System folders auto-created (Daily Journal, Trade Notes, Sessions)
- [ ] Rich text editor works smoothly (tiptap)
- [ ] Auto-save (debounced 2s)
- [ ] Full-text search with highlighting
- [ ] Soft delete + "Recently Deleted" folder (30-day auto-purge)
- [ ] Trade Notes folder collects notes from trade reviews
- [ ] Mobile: sidebar → drawer

---

## Phase Dependencies & Timeline

```
Phase 1 ─────────────────→ ไม่มี dependency
Phase 2 ─────────────────→ ไม่มี dependency (แต่ควรทำหลัง Phase 1)
Phase 3 ─────────────────→ ไม่มี dependency (แต่ควรทำหลัง Phase 1)
Phase 4 ─────────────────→ ไม่มี dependency (แต่แสดงผลใน Phase 1+2 components)
Phase 5 ─────────────────→ ไม่มี dependency (แต่ widget อยู่บน Phase 1 dashboard)
Phase 6 ─────────────────→ ไม่มี dependency
```

### แนะนำลำดับ: 1 → 2 → 3 → 4 → 5 → 6

**เหตุผล**:
- **Phase 1 ก่อน** เพราะ Dashboard เป็นหน้าแรกที่ user เห็น ทำให้ทุกคนรู้สึกว่า app ดีขึ้นทันที
- **Phase 2 ถัดมา** เพราะ Day/Week View เป็น core workflow — trader ใช้ทุกวัน
- **Phase 3 ต่อ** เพราะ Reports ให้ value สูง — trader ต้องการวิเคราะห์ performance
- **Phase 4 ตามมา** เพราะ Insights ทำให้ app "ฉลาด" — สร้างความแตกต่าง
- **Phase 5 ต่อ** เพราะ Checklist เป็น retention feature — ดึง user กลับมาทุกวัน
- **Phase 6 สุดท้าย** เพราะ Notebook เป็น nice-to-have — journal ปัจจุบันใช้ได้อยู่แล้ว

---

## Appendix: สิ่งที่ตัดออก (และเหตุผล)

| Feature | เหตุผลที่ตัด | ทำเมื่อไหร่ |
|---------|-------------|------------|
| Trade Replay | ต้อง recording infra หนักมาก | เมื่อมี user base ใหญ่ |
| Strategy Marketplace | ต้องมี community ก่อน | เมื่อมี > 1000 users |
| Economic Calendar | ใช้ embed TradingView widget แทน | sprint ไหนก็ได้ |
| Currency switcher ($ / % / pips) | Nice-to-have | หลัง Phase 3 |
| Multiple accounts per client | ib-portal model = 1 client 1 account | ถ้า business model เปลี่ยน |
| Recaps (weekly/monthly summaries) | ต้องมี Insights engine ก่อน (Phase 4) | หลัง Phase 4 |
| Mentor mode / Shared strategies | ต้อง redesign permissions | เมื่อมี coaching feature |

---

## Appendix: Migration Checklist (all phases)

| Phase | Migration File | Tables Created |
|-------|---------------|---------------|
| 1 | ไม่ต้อง | — |
| 2 | ไม่ต้อง | — |
| 3 | ไม่ต้อง | — |
| 4 | `add_trade_insights.sql` | `trade_insights` |
| 5 | `add_checklist_system.sql` | `checklist_rules`, `checklist_completions`, `daily_starts` |
| 6 | `add_notebook.sql` | `notebook_folders`, `notebook_notes` |

**Total new tables: 6** (ไม่กระทบ tables ที่มีอยู่)
