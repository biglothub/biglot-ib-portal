# Client User Flow — IB-Portal

คู่มือการใช้งานของ **Client** ตั้งแต่ Login จนถึงการใช้งานทุกฟีเจอร์อย่างสมบูรณ์

---

## สารบัญ

1. [เข้าสู่ระบบ (Login)](#1-เข้าสู่ระบบ-login)
2. [Portfolio Layout (กรอบหลัก)](#2-portfolio-layout-กรอบหลัก)
3. [Overview Dashboard (หน้าหลัก)](#3-overview-dashboard-หน้าหลัก)
4. [Day View / Week View](#4-day-view--week-view)
5. [Trades Explorer](#5-trades-explorer)
6. [Trade Detail Page](#6-trade-detail-page)
7. [Journal (บันทึกประจำวัน)](#7-journal-บันทึกประจำวัน)
8. [Analytics (รายงาน)](#8-analytics-รายงาน)
9. [Playbook](#9-playbook)
10. [Progress (วินัยการเทรด)](#10-progress-วินัยการเทรด)
11. [Live Trade](#11-live-trade)
12. [AI Chat Panel](#12-ai-chat-panel)
13. [Daily Routine — สรุป Flow รายวัน](#daily-routine--สรุป-flow-รายวัน)

---

## 1. เข้าสู่ระบบ (Login)

**Route:** `/auth/login`

```
เปิด /auth/login
    ├── คลิก "เข้าสู่ระบบด้วย Google"
    │       └── OAuth → /auth/callback
    │               ├── ✅ email ตรงกับ client_accounts (status='approved')
    │               │       └── redirect → /portfolio
    │               └── ❌ ไม่ได้รับอนุมัติ → ลบ auth user + แสดง error
    └── (Admin/IB) ใช้ Email + Password แทน
```

**เงื่อนไขสำคัญ:**
- Account ต้องได้รับ approve จาก Admin หรือ Master IB ก่อนเข้าได้
- Client ใช้ Google OAuth เป็นหลัก
- Login สำเร็จ → ระบบ redirect ตาม role: `client → /portfolio`, `admin → /admin`, `master_ib → /ib`

---

## 2. Portfolio Layout (กรอบหลัก)

เมื่อเข้า `/portfolio` ระบบโหลด base data ทันที (ใน `+layout.server.ts`):

- Trades, Daily Stats, Journals, Playbooks, Checklist Rules (โหลดพร้อมกันแบบ parallel)
- Child pages ทุกหน้าดึงข้อมูลผ่าน `parent()` ไม่โหลดซ้ำ

### Navigation Tabs

| Tab | Route | คำอธิบาย |
|---|---|---|
| ภาพรวม | `/portfolio` | Dashboard หลัก |
| รายวัน | `/portfolio/day-view` | Day / Week view |
| เทรด | `/portfolio/trades` | Trade explorer + filter |
| บันทึก | `/portfolio/journal` | Daily journal |
| รายงาน | `/portfolio/analytics` | Analytics 11 แท็บ |
| Playbook | `/portfolio/playbook` | Setup management |
| ความคืบหน้า | `/portfolio/progress` | Checklist + heatmap |
| Live Trade | `/portfolio/live-trade` | Coach streaming |
| วิเคราะห์ทอง | `/portfolio/analysis` | AI gold analysis |

### Header Features (มีทุกหน้า)

| Feature | ทำอะไร |
|---|---|
| Account Switcher | สลับบัญชี (ถ้ามีหลายบัญชี) |
| Sync Status Badge | แสดงเวลา sync ล่าสุด + สถานะ bridge |
| ปุ่ม Sync ตอนนี้ | sync manual (cooldown 60 วินาที) |
| `Cmd+K` หรือ `/` | Search: trades, journals, playbooks |
| `$` / `%` / `p` | เปลี่ยนหน่วยแสดงผล (USD / Percent / Pips) |
| `?` | แสดง keyboard shortcuts ทั้งหมด |

### Keyboard Shortcuts

```
g+o → Overview      g+t → Trades       g+j → Journal
g+a → Analytics     g+p → Playbook     g+r → Progress
Cmd+K / /  → Search
?          → Help
Esc        → ปิด panel
```

### Admin View Mode

ถ้า IB หรือ Admin เปิดดูพอร์ต client จะมี amber banner:
> "Admin View — Read-only"

---

## 3. Overview Dashboard (หน้าหลัก)

**Route:** `/portfolio`

### Section A — KPI Cards (5 ตัว)

```
Net P&L | Win Rate (Trades) | Profit Factor | Win Rate (Days) | Avg Win/Loss
```

- สีเขียว = กำไร, สีแดง = ขาดทุน
- Secondary metrics: Balance, Equity, EV, Recovery Factor

### Section B — Today's Command Center

Status bar แสดงแบบ real-time:
- P&L วันนี้
- จำนวน trades
- จำนวน reviewed trades
- สถานะ journal วันนี้
- Sync status + bridge health

### Section C — Start My Day Button

- สีเขียว = checklist สมบูรณ์แล้ว, สีน้ำเงิน = ยังไม่ได้ทำ
- คลิกเปิด `StartMyDayModal`:
  - Daily Checklist → tick ✅ manual rules
  - Market news / calendar
  - Session plan entry
  - กด Start → บันทึก checklist สำหรับวันนี้

### Sections ที่เหลือ

| Section | รายละเอียด |
|---|---|
| Trading Score Radar | Win rate, PF, Avg Win/Loss, Drawdown, Consistency (6-axis) |
| Activity Heatmap | Grid 1 ปี — วันไหนเทรด / checklist สมบูรณ์แค่ไหน |
| Cumulative P&L Chart | กำไรสะสมตลอดเวลา |
| Daily P&L Bar Chart | กำไร/ขาดทุนรายวัน |
| Recent Trades Panel | 8 trades ล่าสุด + badge review status |
| Open Positions Panel | Positions ที่เปิดอยู่ (unrealized P&L live) |
| Balance/Equity Chart | Balance + floating P&L over time |
| Mini Calendar + Drawdown | Calendar สี + drawdown graph |
| Trade Duration Chart | Scatter plot: duration vs performance |
| Rule Breaks + Setup Performance | ต้นทุนของ mistake + setup performance table |
| AI Coach Card | Insights จาก AI (collapsible) |

### Dashboard Settings

- คลิก gear icon → Popover toggle เปิด/ปิดแต่ละ section
- บันทึกใน `localStorage` key `dashboard-rows`

---

## 4. Day View / Week View

**Route:** `/portfolio/day-view`  
**URL params:** `?view=day` หรือ `?view=week` + `&date=YYYY-MM-DD`

### Day View

เลื่อนดูแต่ละวัน (newest first):

```
Day Card
  ├── Net P&L, Trades, Win Rate, Commissions, Volume, Profit Factor
  ├── Intraday Cumulative Sparkline
  └── รายการ trades ของวันนั้น (expandable)
      └── แต่ละ trade: Symbol, Type, Entry, Exit, P&L
```

- Calendar sticky ด้านขวา (xl+ screens) → คลิกวันเพื่อ scroll ไป
- Day insights (AI-generated) สำหรับวันที่เลือก

### Week View

```
Week Summary: Gross P&L / Total Trades / Win Rate / Profit Factor
Day Cards (แต่ละวันใน week):
  ├── Trades count + P&L
  └── Session breakdown: Asian / London / NY
```

---

## 5. Trades Explorer

**Route:** `/portfolio/trades`

### Trade List

ตาราง 25 trades ต่อหน้า (pagination):

| คอลัมน์ | รายละเอียด |
|---|---|
| Date/Time | วันเวลาเปิด/ปิด |
| Symbol | คู่สกุลเงิน |
| Type | BUY / SELL |
| Entry / Exit | ราคาเข้า/ออก |
| P&L | USD หรือ % |
| Duration | ระยะเวลาถือ |
| Review Status | unreviewed / in_progress / reviewed |
| Tags | tags ที่ติดไว้ |
| Playbook | setup ที่ assign |
| Quality Score | แถบคะแนน |

### Filters (12 มิติ)

```
Date Range | Symbols | Direction (Buy/Sell) | Session (Asian/London/NY)
Win/Loss | Duration | Tags | Playbook | Profit Range | Lot Size | Pips
```

### Actions

```
Group By → None / Day / Session / Setup

Bulk Selection (checkbox หลาย trades):
  ├── Tag ทีเดียวหลาย trades
  ├── เปลี่ยน review status batch
  ├── Assign playbook batch
  └── Export CSV (เฉพาะที่เลือก)

Export All → CSV ทุก trade ที่ filter ไว้
Trade Comparison → เลือก 2+ trades เพื่อเปรียบเทียบ side-by-side
```

---

## 6. Trade Detail Page

**Route:** `/portfolio/trades/[id]`

### Left Column — Trade Info

- Symbol, Type, Lots, Entry/Exit Time, Entry/Exit Price
- P&L (USD + %), Duration, Risk/Reward Ratio

### Right Column — Review & Analysis

#### Trade Notes

```
├── Rich text editor (บันทึกอิสระ)
├── Star rating 1-5 ⭐
└── Save → บันทึก timestamp อัตโนมัติ
```

#### Trade Review (หัวใจหลักของการ review)

```
├── Playbook Assignment → เลือก setup ที่ใช้
├── Entry Reason → ทำไมถึงเข้า
├── Exit Reason → ทำไมถึงออก
├── Execution Notes → บันทึกการ execute
├── Risk Notes → การจัดการความเสี่ยง
│
├── Scores (1-10):
│     Setup Quality | Discipline | Execution | Confidence at Entry
│
├── Followed Plan? → Yes / No / N/A
├── Broken Rules → checkboxes สำหรับ rule แต่ละข้อ
├── Mistakes Summary → สิ่งที่ทำพลาด
├── Lesson Summary → บทเรียนที่ได้
├── Next Action → จะปรับอะไร
│
└── Status → auto-upgrade: unreviewed → in_progress → reviewed
```

#### Screenshots & Attachments

```
├── Upload ภาพ screenshot
├── Annotate: วาด arrows, circles, text บนรูป
└── Add links / attachments
```

#### Replay Chart

```
Multi-timeframe: 4H, 1H, 15m, 5m, 1m
└── Entry/exit markers บน chart
```

#### Related Trades

```
├── Similar trades จาก history ของตัวเอง
└── AI-generated insights เกี่ยวกับ trade นี้
```

---

## 7. Journal (บันทึกประจำวัน)

**Route:** `/portfolio/journal`

### Layout

- **ซ้าย:** Calendar grid รายเดือน  
  - สีแสดงสถานะ: `not_started` / `in_progress` / `complete`
  - วันที่มี trades แสดงจำนวน + P&L
- **กลาง:** Form บันทึกประจำวัน

### Journal Form

#### Pre-Market

```
├── Pre-Market Notes (rich text) → สังเกตการณ์ตลาด
├── Session Plan (rich text) → แผนเทรดของวัน
├── Market Bias → Bullish / Bearish / Neutral
└── Key Levels → แนวรับ/แนวต้านสำคัญ
```

#### Trading Section

```
└── รายการ trades วันนั้น (auto-populated)
    ├── Review status badge แต่ละ trade
    └── Link ไป trade detail
```

#### Post-Market

```
├── Post-Market Notes (rich text) → reflection หลังเทรด
├── Mood (1-5)
├── Energy Score (1-5)
├── Discipline Score (1-5)
└── Confidence Score (1-5)
```

#### Lessons & Planning

```
├── Lessons Learned (rich text)
├── Tomorrow's Focus (rich text)
└── Status Toggle: not_started / in_progress / complete
```

### Actions

- Save (auto-save)
- "End of Day Wizard" → guided flow ทำ journal ให้ครบ
- Generate AI Recap
- View previous journal (เปรียบเทียบ)
- Weekly recap nudge (วันศุกร์/เสาร์/อาทิตย์)

---

## 8. Analytics (รายงาน)

**Route:** `/portfolio/analytics`

11 แท็บ รองรับ filter เดียวกันทั้งหมด:

| แท็บ | รายละเอียด |
|---|---|
| Overview | สรุป stats หลัก + win/loss breakdown |
| Performance | P&L chart + win rate trend + drawdown evolution |
| Calendar | Heatmap ปฏิทิน: วันไหนกำไร/ขาดทุน |
| Symbols | Performance per pair: win rate, avg P&L, trade count |
| Tags | Performance per setup/tag |
| Days of Week | วันไหน (จันทร์–อาทิตย์) เทรดได้ดีที่สุด |
| Time & Daytime | Heatmap ชั่วโมง vs performance + session breakdown |
| Risk | Drawdown history, Risk of Ruin, Variance |
| Recaps & Insights | AI-generated weekly summaries + pattern recognition |
| Compare | เปรียบเทียบ trades side-by-side |
| Correlation | Symbol correlation matrix |

### Filters (ใช้ได้ทุกแท็บ)

```
Date Range | Symbols | Sessions | Direction | Tags/Playbooks
Profit Range | Duration | Lot Size | Win/Loss
```

### Actions

- Export PDF report
- Save custom view / Load saved views

---

## 9. Playbook

**Route:** `/portfolio/playbook`

### My Playbooks Tab

#### Card Layout

```
Card แต่ละ Playbook:
  ├── ชื่อ Setup
  ├── Win Rate | Total Trades | Net P&L | Expectancy
  ├── Active / Inactive toggle
  └── Edit button
```

#### Create / Edit Form

```
├── Name → ชื่อ setup (เช่น "London Breakout")
├── Description → อธิบาย setup
├── Setup Tag → link กับ trade tag
├── Entry Criteria → list เงื่อนไขเข้า
├── Exit Criteria → list เงื่อนไขออก
├── Risk Rules → กฎ risk management
├── Mistakes to Avoid → ข้อผิดพลาดที่ต้องระวัง
├── Example Trades → link trades ตัวอย่าง
└── Active / Inactive toggle
```

#### Actions

- Save (toast feedback: สีเขียว flash + checkmark)
- Delete (with undo toast)
- View example trades
- ดู performance: win rate, P&L, trade count

### Community Playbooks Tab

```
Browse:
  ├── Search by name/description
  ├── Filter by Category:
  │     Scalping | Day Trading | Swing | Breakout
  │     Reversal | Trend | News Trading
  └── Sort by: Popular (clone count) / Newest / Win Rate

Clone → copy template ไปใช้เป็น playbook ของตัวเอง
Card: author, win rate, clone count, rating
```

---

## 10. Progress (วินัยการเทรด)

**Route:** `/portfolio/progress`

### Daily Checklist

```
Manual Rules (user สร้างเอง):
  ├── Checkbox tick ✅ ได้เอง
  ├── Strikethrough เมื่อสมบูรณ์
  └── Add new rule (quick input field)

Automated Rules (system ประเมิน):
  ├── Read-only — ไม่สามารถ tick เองได้
  ├── ประเมินจาก conditions: Max loss %, Overleverage, etc.
  └── แสดงผล pass/fail อัตโนมัติ

Progress Bar: X/Y completed
```

### Progress Heatmap

```
Grid 1 ปี (year-long):
  ├── ความเข้มสี = % checklist ที่สมบูรณ์
  ├── Current Streak counter 🔥
  └── Highlight วันปัจจุบัน
```

### Rules Analytics

```
├── Compliance rate แต่ละ rule
├── จำนวนครั้งที่ทำผิดต่อสัปดาห์
└── Correlation กับ trading performance
```

---

## 11. Live Trade

**Route:** `/portfolio/live-trade`

```
Coach Cards:
  ├── ชื่อ, avatar
  ├── เวลาสอน (Bangkok time — start/end hours)
  ├── YouTube handle
  └── Color-coded border/background

Live Indicator:
  ├── Badge "LIVE" + pulse animation (ถ้า live อยู่)
  └── Real-time Bangkok clock

YouTube Scanner:
  ├── Scan ทุก 2 นาที
  └── Embed preview player ถ้า coach กำลัง live
```

---

## 12. AI Chat Panel

เปิดได้จากทุกหน้าในพอร์ต

```
เปิด:  คลิกปุ่มลอย bottom-right (bounce animation 3 วินาที)
ปิด:   Esc หรือคลิก backdrop

UI:
  ├── Sliding panel จากด้านขวา
  │     (full height บน mobile, 384px บน desktop)
  ├── Chat history (scrollable)
  ├── Multi-line textarea (Enter = ส่ง, Shift+Enter = new line)
  └── Starter Prompts:
        "วิเคราะห์ผลเทรดสัปดาห์นี้"
        "จุดอ่อนในการเทรดของฉันคืออะไร?"
        "Session ไหนที่ฉันเทรดได้ดีที่สุด?"
        "สรุปพอร์ตของฉันวันนี้"

AI ทำได้:
  ├── Streaming responses (real-time)
  ├── Tool-use: ดึง trades, metrics, patterns
  ├── วิเคราะห์ risk + behavioral patterns
  └── ตอบเป็นภาษาไทย (system prompt กำหนดไว้)

Context ที่ AI รู้:
  ├── Client name, account ID, server
  ├── Latest stats: balance, equity, win rate, PF
  └── Last sync time

Rate Limit: 20 messages/minute
```

---

## Daily Routine — สรุป Flow รายวัน

```
──────────────────────────────────────────
เช้า (ก่อนตลาดเปิด)
──────────────────────────────────────────
  1. เปิด Overview
     └── ดู KPI + Open Positions

  2. คลิก "Start My Day"
     └── tick Daily Checklist
     └── เขียน Session Plan

  3. เปิด Live Trade
     └── ดูว่า coach ไหน live อยู่

──────────────────────────────────────────
ระหว่างวัน (ขณะเทรด)
──────────────────────────────────────────
  4. เทรดผ่าน MT5
     └── Trades sync อัตโนมัติจาก bridge

  5. ดู Dashboard → Today's Command Center
     └── ติดตาม P&L + trade count realtime

──────────────────────────────────────────
เย็น/หลังเทรด
──────────────────────────────────────────
  6. เปิด Trades → review ทุก trade
     ├── notes, star rating
     ├── assign playbook
     ├── scores (setup, discipline, execution)
     ├── broken rules
     └── lesson learned

  7. เปิด Journal → บันทึกประจำวัน
     ├── post-market notes
     ├── mood / discipline / confidence (1-5)
     └── lessons + tomorrow's focus

──────────────────────────────────────────
สัปดาห์ละครั้ง
──────────────────────────────────────────
  8. Analytics → ดู pattern + setup performance
     └── เช็ค: ชั่วโมงไหนเทรดดีสุด, session ไหน, setup ไหน

  9. Playbook → ปรับ/เพิ่ม setup จาก lessons

 10. AI Chat → ขอ insight เชิงลึก
     เช่น "เปรียบเทียบ 4 สัปดาห์ที่ผ่านมา มีรูปแบบอะไร?"

──────────────────────────────────────────
ระยะยาว
──────────────────────────────────────────
 11. Progress → ดู checklist streak + discipline heatmap
     └── เป้าหมาย: streak ยาวขึ้นเรื่อยๆ

 12. Day View (Week mode) → เปรียบเทียบ week-over-week

 13. Analytics → Risk tab
     └── ติดตาม drawdown + risk of ruin
```

---

## สรุปฟีเจอร์หลักของ Client

| ฟีเจอร์ | สถานะ |
|---|---|
| Google OAuth login + auto account linking | ✅ |
| Multi-account support (สลับบัญชี) | ✅ |
| Real-time trade sync จาก MT5 bridge | ✅ |
| Dashboard 12+ widgets + toggle visibility | ✅ |
| Daily Checklist + automated rule evaluation | ✅ |
| Trade review: notes, scores, screenshots, replay | ✅ |
| Playbook management + community templates | ✅ |
| Daily Journal + AI insights | ✅ |
| Analytics 11 แท็บ + advanced filters | ✅ |
| Discipline Heatmap + Streak tracking | ✅ |
| Live Trade streaming monitor | ✅ |
| AI Chat assistant (streaming + tool-use) | ✅ |
| Keyboard shortcuts (power user) | ✅ |
| CSV export | ✅ |
| Dark theme + responsive (desktop + mobile) | ✅ |
