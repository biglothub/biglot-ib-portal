# IB-Portal Enhancement Build Plan
## Inspired by TradeZilla — Built for Scale

> ปรัชญา: ไม่เร่งรีบ ค่อยๆ สร้างทีละ module วางคุณภาพเป็นที่ตั้ง
> เป้าหมาย: รองรับ users ระดับล้านคน ใช้ได้จริง ละเอียดทุกรายละเอียด

---

## สิ่งที่เราเลือก **ไม่ทำ** (และเหตุผล)

| Feature | เหตุผลที่ไม่ทำ |
|---------|---------------|
| Trade Replay | Pro feature ที่ต้อง recording infrastructure หนัก ไม่คุ้มค่าในเฟสนี้ |
| Strategy Templates Marketplace | ต้องมี community ก่อน ยังเร็วเกินไป |
| Economic Calendar | ใช้ embed หรือ API จากภายนอกได้ ไม่ต้องสร้างเอง ทำทีหลังได้ |
| Subscription/Billing | ib-portal เป็น institutional model ไม่ใช่ B2C SaaS |
| Intercom/Support Chat | ใช้ third-party ได้ ไม่ต้องสร้างเอง |
| Currency/Unit switcher ($, %, pips) | Nice-to-have แต่ไม่ใช่ core value — ทำทีหลัง |

---

## Module Map — สิ่งที่เราจะสร้าง

```
Module 1: Dashboard Enhancement
Module 2: Day View & Week View
Module 3: Reports Engine
Module 4: Trade Insights Engine
Module 5: Daily Checklist & Progress System
Module 6: Notebook System
```

แต่ละ module ออกแบบให้เป็นอิสระจากกัน สร้างเสร็จแล้วใช้ได้เลยไม่ต้องรอ module อื่น

---

## Module 1: Dashboard Enhancement

### ปัญหาที่แก้
Dashboard ปัจจุบันมี Command Center + metrics cards + charts แต่ยังขาด KPIs สำคัญที่ trader ต้องการ

### สิ่งที่ต้องสร้าง

#### 1.1 KPI Cards Row (ใหม่)
เพิ่ม cards ใหม่ด้านบน dashboard:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Net P&L     │ │ Trade Win % │ │ Profit      │ │ Day Win %   │ │ Avg Win/    │
│ $14,742     │ │ 31.78%      │ │ Factor 1.82 │ │ 57.58%      │ │ Loss 3.90   │
│ 📋 copy     │ │ ◐ donut     │ │ ○ gauge     │ │ ◐ donut     │ │ ██ bar      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Data source**: ดึงจาก `trades` table + `daily_stats` ที่มีอยู่แล้ว
**Components ที่ต้องสร้าง**:
- `KpiCard.svelte` — reusable card component
- `DonutChart.svelte` — mini donut/gauge for win rate
- `GaugeChart.svelte` — circular gauge for profit factor
- `WinLossBar.svelte` — dual bar showing avg win vs avg loss

**คำนวณ**:
- Net P&L = SUM(profit) จาก trades ในช่วงที่เลือก
- Trade Win % = (winning trades / total trades) × 100
- Profit Factor = SUM(winning P&L) / ABS(SUM(losing P&L))
- Day Win % = (profitable days / total trading days) × 100
- Avg Win/Loss = AVG(winning P&L) / ABS(AVG(losing P&L))

#### 1.2 Cumulative P&L Line Chart
เพิ่ม chart แสดง cumulative P&L ตลอดช่วงเวลา:

**Implementation**:
- ใช้ lightweight-charts ที่มีอยู่แล้ว
- Data: daily cumulative sum จาก `daily_stats`
- Options: 30 days, 90 days, 6 months, 1 year, All time

#### 1.3 Date Range Filter บน Dashboard
- ปัจจุบัน dashboard ไม่มี date filter
- เพิ่ม date range picker component ที่ top bar
- เมื่อเปลี่ยน date range → recalculate ทุก KPI + chart

#### 1.4 Trading Score Radar Upgrade (3→6 แกน)
เพิ่มแกนใหม่ใน radar chart:
- ✅ Win Rate (มีแล้ว)
- ✅ Profit Factor (มีแล้ว)
- ✅ Avg Win/Loss (มีแล้ว)
- **ใหม่: Recovery Factor** = Net P&L / Max Drawdown
- **ใหม่: Max Drawdown %** = inverted (ยิ่ง drawdown น้อย ยิ่งคะแนนสูง)
- **ใหม่: Consistency** = 1 - (StdDev of daily P&L / Avg daily P&L)

### Database Changes
ไม่ต้องเปลี่ยน schema — ใช้ data จาก `trades` + `daily_stats` ที่มีอยู่แล้ว

### Files ที่ต้องแก้/สร้าง
```
src/lib/components/portfolio/
  ├── KpiCard.svelte          (ใหม่)
  ├── DonutChart.svelte       (ใหม่)
  ├── GaugeChart.svelte       (ใหม่)
  ├── WinLossBar.svelte       (ใหม่)
  ├── CumulativePnlChart.svelte (ใหม่)
  └── TradingScoreRadar.svelte  (แก้ไข — เพิ่ม 3 แกน)

src/routes/(app)/portfolio/[id]/
  └── +page.svelte            (แก้ไข — เพิ่ม KPI row + date filter)
```

### Quality Checklist
- [ ] ทุก chart มี loading skeleton
- [ ] ทุกตัวเลขมี tooltip อธิบายว่าคำนวณอย่างไร (?)
- [ ] Responsive: ทำงานได้ดีบน mobile
- [ ] Performance: ใช้ server-side calculation ไม่ใช่ client-side loop
- [ ] Empty state: แสดงข้อความเมื่อไม่มีข้อมูล
- [ ] Animation: chart มี fade-in animation เบาๆ

---

## Module 2: Day View & Week View

### ปัญหาที่แก้
Trader ต้องการดู performance รายวันแบบ quick glance — ปัจจุบันต้องเข้า Trade Explorer แล้ว filter เอง

### สิ่งที่ต้องสร้าง

#### 2.1 Day View Page

```
┌──────────────────────────────────────┐ ┌────────────┐
│ Day View                              │ │ March 2026 │
│ [Day] [Week]     Filters  Date range  │ │ Su Mo Tu.. │
│                                        │ │  1  2  3.. │
│ ┌──────────────────────────────────┐  │ │ 15 ← today │
│ │ March 15, 2026                    │  │ │            │
│ │                                    │  │ └────────────┘
│ │ Trade 1: XAUUSD BUY  +$450       │  │
│ │ Trade 2: EURUSD SELL -$120       │  │
│ │ Trade 3: XAUUSD SELL +$280       │  │
│ │                                    │  │
│ │ Daily Summary:                     │  │
│ │ P&L: +$610 | 3 trades | 66% WR   │  │
│ └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Implementation**:
- Route: `/portfolio/[id]/day-view`
- ใช้ `trades` table filter by date
- Calendar component highlight วันที่มี trades (สีเขียว = profit, สีแดง = loss)
- Click วันใน calendar → โหลด trades ของวันนั้น

#### 2.2 Week View

```
┌──────────────────────────────────────────────────────────────┐
│ Week: Jun 23 - Jun 29, 2024       Net P&L: $672.97          │
│                                                                │
│  Sun 23  │  Mon 24  │  Tue 25  │  Wed 26  │  Thu 27  │ Fri 28│
│          │  $225    │  $300    │  -$37.5  │          │ $185  │
│          │ 3 Trades │ 3 Trades │ 2 Trades │          │ 2 Tr  │
│                                                                │
│ ┌─ Weekly Summary ────────────────────────────────────────┐   │
│ │ Total Trades: 10 │ Win Rate: 40% │ Profit Factor: 1.40 │   │
│ │ Gross P&L: $687  │ Volume: 251   │ Commissions: $14.3  │   │
│ │ Max Loss: -$4,881│ Max Profit: $10,362                  │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌─ Daily P&L Chart (bar) ─┐                                  │
│ │  ██                      │                                  │
│ │  ██  ██      ██          │                                  │
│ │ ─────────██──────        │                                  │
│ │  Su Mo Tu We Th Fr Sa    │                                  │
│ └──────────────────────────┘                                  │
│                                                                │
│ ┌─ Trade List ─────────────────────────────────────────────┐  │
│ │ Day         │ Open time │ Symbol │ Side │ Net P&L │ ...  │  │
│ │ Fri, Jun 28 │ 12:23:28  │ AAPL   │ CALL │ $7.89   │      │  │
│ │ Fri, Jun 28 │ 12:25:01  │ NFLX   │ CALL │ $315    │      │  │
│ └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Implementation**:
- Toggle tab ใน Day View page เดียวกัน
- Query trades by week range (Monday-Sunday)
- Calculate weekly aggregates server-side
- Navigation: < Previous week | This week | Next week >

### Database Changes
ไม่ต้อง — ใช้ `trades` + `daily_stats` ที่มีอยู่

### Files ที่ต้องสร้าง
```
src/routes/(app)/portfolio/[id]/day-view/
  ├── +page.server.ts        (load trades by date/week)
  └── +page.svelte           (Day/Week view UI)

src/lib/components/portfolio/
  ├── DayViewCalendar.svelte  (mini calendar with P&L colors)
  ├── WeekSummary.svelte      (weekly stats cards)
  ├── DailyPnlBarChart.svelte (bar chart per day of week)
  └── DayTradeList.svelte     (trade list for selected day)
```

### Quality Checklist
- [ ] Calendar shows P&L hue (green gradient for profit, red for loss)
- [ ] Keyboard navigation: ← → keys to change day/week
- [ ] URL state: selected date in query params (shareable/bookmarkable)
- [ ] Transition animation between day/week views
- [ ] Empty state for days with no trades

---

## Module 3: Reports Engine

### ปัญหาที่แก้
ib-portal มี Analytics page แต่ยังไม่มี customizable reports, symbol breakdown, comparison tool, หรือ year calendar

### สิ่งที่ต้องสร้าง (เรียงตามความสำคัญ)

#### 3.1 Reports: Performance Page (สำคัญที่สุด)

**Concept**: Customizable dual-chart dashboard ที่ trader เลือก metric และ timeframe ได้เอง

```
┌──────────────────────────────────────────────────────────────┐
│ Reports > Performance                    NET P&L ▼  Export PDF│
│                                                                │
│ ┌─ Chart 1 ──────────────────┐ ┌─ Chart 2 ──────────────────┐│
│ │ Net P&L cumul.. ▼  Day ▼ ⋮ │ │ Avg daily win/l ▼  Day ▼ ⋮ ││
│ │ + Add metric                │ │ + Add metric                ││
│ │                              │ │                              ││
│ │     ╱──────╱╲──────         │ │  ██                          ││
│ │    ╱                        │ │  ██ ██    ██ ██              ││
│ │ ──╱                         │ │  ██ ██ ██ ██ ██ ██           ││
│ │                              │ │                              ││
│ └──────────────────────────────┘ └──────────────────────────────┘│
│                                                                │
│ [Summary] [Days] [Trades]                                      │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Summary table with key metrics                            │   │
│ └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Available Metrics (dropdown)**:
- Net P&L (cumulative / daily)
- Avg daily win/loss
- Win rate (%)
- Profit factor
- Trade count
- Volume
- Commissions
- Max drawdown

**Timeframes**: Day, Week, Month

**Implementation**:
- Reusable `ConfigurableChart.svelte` component
- Metric selector dropdown
- Timeframe toggle
- "+ Add metric" to overlay multiple lines
- Summary/Days/Trades sub-tabs below charts

#### 3.2 Reports: Calendar (Year View)

```
┌──────────────────────────────────────────────────────────────┐
│ Reports > Calendar          2026 ▼       NET P&L ▼           │
│                                                                │
│  ┌─ January ──┐  ┌─ February ─┐  ┌─ March ────┐             │
│  │ 1  2  3  4 │  │ 1  2  3  4 │  │ 1  2  3  4 │             │
│  │ 5 ██ 7  8 │  │ 5  6  7  8 │  │ 5  6  7 ██ │             │
│  │...         │  │...         │  │...         │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                                                                │
│  ██ = green (profit)  ██ = red (loss)  ░░ = no trades        │
│                                                                │
│  Click any day → show daily summary popup                     │
└──────────────────────────────────────────────────────────────┘
```

**Implementation**:
- Query: `SELECT date, SUM(profit) FROM daily_stats WHERE year = ? GROUP BY date`
- Color scale: gradient from deep red → light red → light green → deep green
- Click day → modal with daily summary
- Year selector dropdown

#### 3.3 Reports: Symbols

```
┌──────────────────────────────────────────────────────────────┐
│ Reports > Symbols                                              │
│                                                                │
│ ┌─ Symbol Performance Table ───────────────────────────────┐  │
│ │ Symbol │ Trades │ Win Rate │ Profit Factor │ Net P&L     │  │
│ │ XAUUSD │   45   │  62%     │    2.1        │  +$4,500    │  │
│ │ EURUSD │   30   │  53%     │    1.4        │  +$1,200    │  │
│ │ GBPUSD │   22   │  41%     │    0.8        │   -$800     │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌─ P&L by Symbol (pie/bar chart) ─────────────────────────┐  │
│ │  visualization                                            │  │
│ └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Implementation**:
- GROUP BY symbol FROM trades
- Sortable columns
- Click symbol → drill down to trades of that symbol

#### 3.4 Reports: Compare Tool

```
┌──────────────────────────────────────────────────────────────┐
│ Reports > Compare                                              │
│                                                                │
│ ┌─ Group 1 ──────────────┐  ┌─ Group 2 ──────────────┐      │
│ │ Symbol: [XAUUSD     ▼] │  │ Symbol: [EURUSD     ▼] │      │
│ │ Side:   [All        ▼] │  │ Side:   [All        ▼] │      │
│ │ Tags:   [          ▼] │  │ Tags:   [          ▼] │      │
│ │ Date:   [start] [end]  │  │ Date:   [start] [end]  │      │
│ └────────────────────────┘  └────────────────────────┘      │
│                                                                │
│            [RESET]  [GENERATE REPORT]                          │
│                                                                │
│ ┌─ Comparison Results ─────────────────────────────────────┐  │
│ │ Metric        │ Group 1  │ Group 2  │ Diff              │  │
│ │ Net P&L       │ +$4,500  │ +$1,200  │ +$3,300 (275%)    │  │
│ │ Win Rate      │ 62%      │ 53%      │ +9%               │  │
│ │ Profit Factor │ 2.1      │ 1.4      │ +0.7              │  │
│ │ Avg Trade     │ $100     │ $40      │ +$60              │  │
│ └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Implementation**:
- 2 filter panels side-by-side
- Generate Report → query both groups → show comparison table
- Highlight which group performs better per metric

#### 3.5 Export PDF
- ใช้ library เช่น `jspdf` + `html2canvas`
- Export current report view as PDF
- Include: charts, tables, date range, account info

### Database Changes
ไม่ต้อง — ใช้ data ที่มีอยู่แล้ว + SQL aggregation

### Files ที่ต้องสร้าง
```
src/routes/(app)/portfolio/[id]/reports/
  ├── +layout.svelte          (reports nav: Performance, Calendar, Symbols, Compare)
  ├── performance/
  │   ├── +page.server.ts
  │   └── +page.svelte
  ├── calendar/
  │   ├── +page.server.ts
  │   └── +page.svelte
  ├── symbols/
  │   ├── +page.server.ts
  │   └── +page.svelte
  └── compare/
      ├── +page.server.ts
      └── +page.svelte

src/lib/components/reports/
  ├── ConfigurableChart.svelte
  ├── MetricSelector.svelte
  ├── YearCalendar.svelte
  ├── SymbolTable.svelte
  ├── ComparePanel.svelte
  └── ExportPdfButton.svelte
```

### Quality Checklist
- [ ] Charts are interactive (hover tooltips with values)
- [ ] All tables are sortable by clicking column headers
- [ ] Reports load quickly — use server-side aggregation with SQL
- [ ] Print-friendly layout for PDF export
- [ ] Remember last selected metrics/timeframes in localStorage
- [ ] URL params for sharing specific report views

---

## Module 4: Trade Insights Engine

### ปัญหาที่แก้
Trader ต้องการ feedback อัตโนมัติจากข้อมูลเทรด — ปัจจุบันต้องวิเคราะห์เอง

### สิ่งที่ต้องสร้าง

#### 4.1 Insight Rules Engine

สร้างระบบ rules ที่ auto-detect patterns จาก trade data:

```typescript
// Insight Rule Interface
interface InsightRule {
  id: string;
  name: string;
  category: 'positive' | 'negative' | 'neutral';
  description: string;
  evaluate(trade: Trade, context: TradeContext): InsightResult | null;
}

interface InsightResult {
  rule_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, any>;
}
```

#### 4.2 Initial Insight Rules (เริ่ม 10 rules ที่สำคัญที่สุด)

**Positive Insights (สีเขียว)**:
1. **No Drawdown** — Trade ไม่เคย drawdown เลย (opened green, closed green)
2. **Red to Green** — Trade เริ่มติดลบแต่กลับมา profit ได้
3. **Exceeded Average Profit** — Profit มากกว่า average ของ symbol นี้

**Negative Insights (สีแดง)**:
4. **Green to Red** — Trade เคย profit แต่กลับมาติดลบ
5. **Exceeded Average Hold Time** — ถือนานกว่าปกติ
6. **Drawdown Exceeded Profit** — Max drawdown มากกว่า final profit
7. **Loss Streak Short Gap** — ขาดทุนหลายครั้งติดต่อกันในเวลาสั้น (revenge trading?)
8. **Loser Long Hold** — ขาดทุนและถือนานเกินไป (ไม่ตัดขาดทุน)

**Analysis Insights (สีน้ำเงิน)**:
9. **Scale In Detected** — เพิ่ม position ระหว่าง trade
10. **Scale Out Detected** — ลด position ระหว่าง trade

#### 4.3 Insight Display

แสดงใน 2 ที่:
1. **Trade View table** — column "Insights" แสดง count badge (เช่น "2")
2. **Trade Detail page** — section "Insights" แสดงรายละเอียดทุก insight

```
┌─ Trade Insights ──────────────────────────────────────┐
│ 🟢 No Drawdown                                         │
│    This trade never went into drawdown. Great entry!    │
│                                                         │
│ 🔴 Exceeded Average Hold Time                           │
│    Held for 4h 23m vs average 1h 45m for XAUUSD        │
└─────────────────────────────────────────────────────────┘
```

#### 4.4 Trade Quality Score (Zella Scale equivalent)

คำนวณ score 0-100 ต่อ trade:
- Entry quality (30%): เทียบกับ average entry timing
- Risk management (30%): SL placement, drawdown control
- Execution (20%): hold time appropriate, exit timing
- Outcome (20%): P&L relative to risk taken

แสดงเป็น **progress bar สี gradient** (แดง→เหลือง→เขียว) ใน trade table

### Database Changes
```sql
-- New table for storing computed insights
CREATE TABLE trade_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  category TEXT NOT NULL, -- positive, negative, neutral
  severity TEXT NOT NULL, -- info, warning, critical
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trade_insights_trade ON trade_insights(trade_id);

-- Add quality_score to trades
ALTER TABLE trades ADD COLUMN quality_score NUMERIC(5,2);
```

### Files ที่ต้องสร้าง
```
src/lib/server/insights/
  ├── engine.ts              (InsightEngine class)
  ├── rules/
  │   ├── no-drawdown.ts
  │   ├── red-to-green.ts
  │   ├── green-to-red.ts
  │   ├── exceed-avg-profit.ts
  │   ├── exceed-avg-hold.ts
  │   ├── drawdown-exceed-profit.ts
  │   ├── loss-streak.ts
  │   ├── loser-long-hold.ts
  │   ├── scale-in.ts
  │   └── scale-out.ts
  └── quality-score.ts       (Trade Quality Score calculator)

src/lib/components/portfolio/
  ├── InsightBadge.svelte    (count badge for trade table)
  ├── InsightList.svelte     (detail list for trade detail page)
  └── QualityScoreBar.svelte (gradient progress bar)
```

### Quality Checklist
- [ ] Insights compute asynchronously (don't block trade sync)
- [ ] Insights re-compute when trade data changes
- [ ] Each insight has a clear, actionable message
- [ ] Rules are extensible — easy to add new rules
- [ ] Performance: batch process insights (ไม่ทำทีละ trade)

---

## Module 5: Daily Checklist & Progress System

### ปัญหาที่แก้
Trader ต้องการระบบติดตาม discipline — ไม่ใช่แค่ P&L แต่รวมถึงนิสัยการเทรดด้วย

### สิ่งที่ต้องสร้าง

#### 5.1 Daily Checklist

```
┌─ Today's Checklist ─────────────────────────────────────┐
│ ✅ MANUAL RULES (2)                                      │
│ ☑ Meditation before market opens                         │
│ ☐ Daily workout                                          │
│                                                           │
│ 🤖 AUTOMATED RULES (3)                                   │
│ ✅ Link trades to playbook          75% / 90%            │
│ ❌ Trade has stop loss              0% / 100%            │
│ ⏳ Journal added by                 9:30AM               │
│                                                           │
│ Today's progress: 2/5  ████░░░░░░                        │
└──────────────────────────────────────────────────────────┘
```

**Manual Rules**: User สร้างเอง, check/uncheck ด้วยมือ
**Automated Rules**: System ตรวจสอบอัตโนมัติจาก data:
- "Link trades to playbook" → check % of today's trades linked to playbook
- "Trade has stop loss" → check % of today's trades with SL
- "Journal added by [time]" → check if journal exists before specified time
- "Start my day by [time]" → check if "start day" clicked before time
- "Net max loss /trade" → check if any trade exceeds max loss
- "Net max loss /day" → check if daily P&L exceeds max loss

#### 5.2 "Start My Day" Flow

ปุ่ม "Start my day" บน Dashboard/Day View:
1. Click → open modal
2. Modal shows: Today's checklist + any pre-market journal to fill
3. User checks manual items
4. Close → checklist saved, "started" timestamp recorded

#### 5.3 Progress Heatmap

```
┌─ Progress Tracker ──────────────────────────────────────┐
│                    Feb                  Mar               │
│ Sun  ░░ ░░ ░░ ░░ ░░   ░░ ░░ ░░ ░░                      │
│ Mon  ░░ ██ ██ ░░ ██   ██ ░░ ██ ░░                      │
│ Tue  ░░ ██ ██ ██ ██   ██ ██ ██ ░░                      │
│ Wed  ░░ ░░ ██ ██ ██   ██ ██ ░░ ░░                      │
│ Thu  ░░ ██ ██ ██ ░░   ░░ ██ ██ ░░                      │
│ Fri  ░░ ██ ██ ██ ██   ██ ██ ██ ░░                      │
│ Sat  ░░ ░░ ░░ ░░ ░░   ░░ ░░ ░░ ░░                      │
│                                                           │
│ Less ░░ ▒▒ ▓▓ ██ More                                   │
│                                                           │
│ Current streak: 12 days 🔥                               │
│ Current period score: 89%                                 │
└──────────────────────────────────────────────────────────┘
```

**Heatmap intensity** = checklist completion % of that day
- 0% = ░░ (empty)
- 25-50% = ▒▒ (light)
- 50-75% = ▓▓ (medium)
- 75-100% = ██ (dark)

#### 5.4 Rules Performance Table

```
┌─ Rule Performance ──────────────────────────────────────────┐
│ Rule                    │ Condition │ Streak │ Avg Perf │ Follow Rate│
│ Start my day by 09:30   │ 09:30     │ 0      │ --       │ 0%        │
│ Link trades to playbook │ 100%      │ 0      │ 0%       │ 0%        │
│ Input SL to all trades  │ 100%      │ 0      │ 0%       │ 0%        │
│ Net max loss /trade     │ $100      │ 0      │ $0       │ 0%        │
│ Net max loss /day       │ $500      │ 0      │ $0       │ 0%        │
└──────────────────────────────────────────────────────────────┘
```

### Database Changes
```sql
-- Checklist rules (user-defined)
CREATE TABLE checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'manual' | 'automated'
  condition JSONB, -- e.g., {"type": "time", "value": "09:30"} or {"type": "percentage", "value": 100}
  automated_check TEXT, -- e.g., 'trades_have_sl', 'trades_linked_playbook', 'journal_by_time'
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily checklist completions
CREATE TABLE checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES checklist_rules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  auto_value NUMERIC, -- for automated rules: actual value
  UNIQUE(rule_id, date)
);

-- "Start my day" tracking
CREATE TABLE daily_starts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  UNIQUE(client_id, date)
);

CREATE INDEX idx_checklist_completions_date ON checklist_completions(client_id, date);
```

### Files ที่ต้องสร้าง
```
src/routes/(app)/portfolio/[id]/progress/
  ├── +page.server.ts
  └── +page.svelte

src/lib/components/portfolio/
  ├── DailyChecklist.svelte
  ├── StartMyDayModal.svelte
  ├── ProgressHeatmap.svelte
  ├── RulesTable.svelte
  └── StreakCounter.svelte

src/lib/server/
  └── checklist-evaluator.ts  (evaluate automated rules)
```

### Quality Checklist
- [ ] Automated rules evaluate in real-time (ไม่ต้อง refresh)
- [ ] Heatmap renders smoothly even with 365 days of data
- [ ] Streak calculation handles weekends correctly
- [ ] Default rules provided on first use (ไม่ต้องสร้างจาก 0)
- [ ] Celebration animation when completing all daily checks

---

## Module 6: Notebook System

### ปัญหาที่แก้
Journal ปัจจุบันมีแค่ daily entries — trader ต้องการ flexible note-taking system

### สิ่งที่ต้องสร้าง

#### 6.1 Notebook Page with Folders

```
┌──────────────────────────────────────────────────────────────┐
│ Notebook                                                       │
│ ┌─ Search notes ──────────────────────┐ 🔍                    │
│ └──────────────────────────────────────┘                       │
│                                                                │
│ ┌─ Sidebar ──────┐  ┌─ Note Content ──────────────────────┐  │
│ │ 📁 Add folder   │  │                                      │  │
│ │                  │  │  [Rich text editor]                  │  │
│ │ Folders ▼        │  │                                      │  │
│ │  📄 All notes    │  │  Pre-market analysis for today...    │  │
│ │  📊 Trade Notes  │  │                                      │  │
│ │  📅 Daily Journal│  │  Key levels:                         │  │
│ │  🔄 Sessions     │  │  - 2650 resistance                   │  │
│ │                  │  │  - 2620 support                      │  │
│ │ My notes ▼       │  │                                      │  │
│ │  📝 Custom note  │  │  Market bias: Bullish               │  │
│ │                  │  │                                      │  │
│ │ Tags ▼           │  │                                      │  │
│ │  #strategy       │  │                                      │  │
│ │  #review         │  │                                      │  │
│ │                  │  │                                      │  │
│ │ 🗑 Recently      │  │                                      │  │
│ │   deleted        │  │                                      │  │
│ └──────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### 6.2 Note Features
- Rich text editor (bold, italic, lists, headings)
- Link notes to trades (Trade Notes folder)
- Link notes to dates (Daily Journal folder)
- Tag notes for organization
- Search across all notes (full-text search)
- Soft delete with "Recently deleted" recovery

#### 6.3 Default Folders (auto-created)
- **All notes** — aggregate view
- **Trade Notes** — auto-linked when reviewing trades
- **Daily Journal** — one per day, linked to calendar
- **Sessions Recap** — linked to trading sessions (Asian, London, NY)

### Database Changes
```sql
CREATE TABLE notebook_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'system' | 'custom'
  system_type TEXT, -- 'all' | 'trade_notes' | 'daily_journal' | 'sessions'
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notebook_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES notebook_folders(id),
  title TEXT,
  content TEXT, -- rich text (HTML or Markdown)
  linked_trade_id UUID REFERENCES trades(id),
  linked_date DATE,
  linked_session TEXT, -- 'asian' | 'london' | 'new_york'
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notebook_note_tags (
  note_id UUID REFERENCES notebook_notes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (note_id, tag)
);

CREATE INDEX idx_notebook_notes_client ON notebook_notes(client_id, is_deleted);
CREATE INDEX idx_notebook_notes_search ON notebook_notes USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
```

### Files ที่ต้องสร้าง
```
src/routes/(app)/portfolio/[id]/notebook/
  ├── +page.server.ts
  └── +page.svelte

src/lib/components/notebook/
  ├── NotebookSidebar.svelte
  ├── NoteEditor.svelte       (rich text editor — ใช้ tiptap or similar)
  ├── NoteList.svelte
  ├── FolderManager.svelte
  └── NoteSearch.svelte
```

### Quality Checklist
- [ ] Rich text editor is lightweight and fast
- [ ] Auto-save notes (debounced, every 2 seconds of inactivity)
- [ ] Full-text search with highlighting
- [ ] Soft delete with 30-day auto-purge
- [ ] Mobile-friendly: sidebar becomes drawer
- [ ] Keyboard shortcuts (Cmd+S save, Cmd+N new note)

---

## Build Order & Dependencies

```
Module 1: Dashboard Enhancement  ←── ไม่มี dependency เริ่มได้เลย
    │
Module 2: Day View & Week View   ←── ไม่มี dependency เริ่มได้เลย
    │
Module 3: Reports Engine          ←── ไม่มี dependency เริ่มได้เลย
    │
Module 4: Trade Insights Engine   ←── ไม่มี dependency แต่ควรทำหลัง Module 1
    │                                   (เพราะ insights แสดงใน trade table)
Module 5: Daily Checklist         ←── ไม่มี dependency แต่ควรทำหลัง Module 2
    │                                   (เพราะ "Start my day" อยู่ใน Day View)
Module 6: Notebook System         ←── ไม่มี dependency เริ่มได้เลย
```

### แนะนำ: เริ่มจาก Module 1 → 2 → 3 → 4 → 5 → 6
เหตุผล:
- Module 1 (Dashboard) เห็นผลทันที, user ทุกคนใช้ทุกวัน
- Module 2 (Day/Week View) ต่อเนื่องจาก Dashboard, เป็น core workflow ของ trader
- Module 3 (Reports) เพิ่ม value ให้ analytics ที่มีอยู่แล้ว
- Module 4 (Insights) ทำให้ app "ฉลาด" ขึ้น — differentiator จาก TradeZella
- Module 5 (Checklist) discipline tracking — ช่วย retention
- Module 6 (Notebook) flexible note-taking — nice to have

---

## Design Principles

1. **Server-first**: ทำ computation บน server (SQL aggregation) ไม่ใช่ client
2. **Progressive enhancement**: ทำงานได้แม้ JS ยังไม่โหลด
3. **Accessibility**: ทุก component ต้อง keyboard navigable
4. **Performance**: ทุกหน้าต้อง load ใน <2 วินาที
5. **Empty states**: ทุก component ต้องมี empty state ที่สวยงาม
6. **Error states**: ทุก API call ต้อง handle error gracefully
7. **Mobile-first**: ออกแบบ mobile ก่อน แล้วขยายเป็น desktop
8. **Consistent patterns**: ใช้ component patterns เดียวกันทั้ง app
9. **Real-time**: ข้อมูลอัพเดตแบบ real-time ผ่าน Supabase subscriptions
10. **Testable**: ทุก utility function มี unit test

---

## หมายเหตุ

เอกสารนี้เป็น living document — จะอัพเดตเมื่อเริ่มสร้างแต่ละ module
ทุก module จะมี checklist ของตัวเอง ต้อง ✅ ครบก่อนถึงจะถือว่าเสร็จ
