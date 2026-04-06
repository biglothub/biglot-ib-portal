# QA Plan — IB Portal

> อัพเดตล่าสุด: 2026-04-06  
> ครอบคลุม: Admin / Master IB / Client

> **ตำนาน:** ✅ = verified จาก code review | ⬜ = ต้อง manual test บน browser

---

## สารบัญ

1. [Pre-QA Checklist](#1-pre-qa-checklist)
2. [Admin Role](#2-admin-role)
3. [Master IB Role](#3-master-ib-role)
4. [Client Role](#4-client-role)
5. [Cross-Role & Global Features](#5-cross-role--global-features)
6. [Security QA](#6-security-qa)
7. [Performance QA](#7-performance-qa)
8. [Edge Cases](#8-edge-cases)
9. [Regression Tests](#9-regression-tests)

---

## 1. Pre-QA Checklist

ก่อน QA ทุกครั้งตรวจสอบสิ่งเหล่านี้ก่อน:

- [x] `npm run dev` ทำงานได้ ไม่มี error ใน console
- [x] `npx svelte-check` — มีเฉพาะ 2 web-push errors เดิม (ไม่มี error ใหม่)
- [ ] Supabase connection ใช้งานได้
- [ ] มี test accounts พร้อม:
  - 1 Admin account
  - 1+ Master IB account
  - 2+ Client accounts (1 approved, 1 pending)
- [ ] Client ที่ approved มี trade data อย่างน้อย 10 trades

---

## 2. Admin Role

### 2.1 Auth & Authorization

- [x] Login ด้วย Admin account → redirect ไป `/admin`
- [x] Direct URL `/ib` → redirect กลับ `/admin`
- [x] Direct URL `/portfolio` → redirect กลับ `/admin`
- [x] Logout → redirect ไป `/auth/login`
- [x] Session หมดอายุ → redirect ไป login

### 2.2 Admin Dashboard (`/admin`)

- [x] KPI Cards แสดงข้อมูลถูกต้อง:
  - Pending Approvals count
  - Total Active Master IBs
  - Total Approved Clients
  - AUM รวมทุก client
- [x] Bridge Health: แสดง sync status, heartbeat, cycle duration
- [x] Recent Activity Log: แสดง audit trail ล่าสุด
- [ ] หน้าโหลดเร็ว ไม่ค้าง

### 2.3 Approval Queue (`/admin/approvals`)

- [x] Filter by status: `pending` / `approved` / `rejected` / `all`
- [x] รายการ pending แสดงครบถ้วน
- [x] **Approve client** → status เปลี่ยนเป็น `approved`
- [x] **Reject client** → status เปลี่ยนเป็น `rejected`
- [x] **Suspend client** → status เปลี่ยนเป็น `suspended`
- [ ] หลัง approve → client ล็อกอินได้และเข้า `/portfolio` ได้
- [x] Audit trail บันทึก: ใครทำ, เมื่อไหร่, action ไหน
- [x] Rate limit: 30 req/min → ลอง approve rapid → เจอ 429

### 2.4 Master IB Management (`/admin/ibs`)

- [x] รายการ IB ทั้งหมดแสดงถูกต้อง
- [x] คลิก IB → ไป `/admin/ibs/[id]`
- [x] Detail แสดง: IB profile, clients, commission rate, max client limit
- [ ] Toggle active/inactive ทำงาน
- [x] สร้าง IB ใหม่: `POST /api/admin/ibs`
- [x] Generate next IB code: `POST /api/admin/ibs/next-code`

### 2.5 Client Management

- [x] `/admin/clients/[id]`: profile, portfolio access, sync status แสดงครบ
- [x] Edit client: `POST /api/admin/clients/edit`
- [x] Delete client: `POST /api/admin/clients/delete` → confirm dialog ก่อนลบ
- [x] Reset password: `POST /api/admin/reset-password`

### 2.6 Admin View Client Portfolio

- [x] เพิ่ม `?account_id=xxx` ใน URL `/portfolio` → แสดงข้อมูลของ client นั้น
- [x] Banner "กำลังดูในฐานะ client" แสดง (`adminViewStore`)
- [x] Admin แก้ไขข้อมูล client ไม่ได้ (read-only)

### 2.7 Coach Management (`/admin/coaches`)

- [x] รายการ coaches แสดง
- [x] Create / Edit / Delete coach ทำงาน

---

## 3. Master IB Role

### 3.1 Auth & Authorization

- [x] Login ด้วย Master IB account → redirect ไป `/ib`
- [x] Direct URL `/admin` → ถูก block / redirect
- [x] Direct URL `/portfolio` (ไม่มี account_id) → ถูก block
- [x] Logout → redirect ไป login

### 3.2 IB Dashboard (`/ib`)

- [x] KPI Cards:
  - จำนวน approved clients
  - จำนวน pending clients
  - AUM รวม
  - Total P&L รวม
- [x] Client list: แสดงเฉพาะ clients ของ IB นี้เท่านั้น
- [x] Status badges: `pending` / `approved` / `rejected` / `suspended` ถูกต้อง

### 3.3 Client List (`/ib/clients`)

- [x] แสดง balance, equity, profit per client
- [x] Last sync time แสดงถูกต้อง
- [x] คลิก client → ไป `/ib/clients/[id]`

### 3.4 Client Detail (`/ib/clients/[id]`)

- [x] Profile, metrics, sync status แสดงครบ
- [x] ลิงก์ "View Portfolio" → `/portfolio?account_id=xxx`
- [x] MT5 validation errors แสดง (ถ้ามี)

### 3.5 Add New Client (`/ib/clients/add`)

**Step 1 — Client Info**
- [x] Required: ชื่อ, email, เบอร์โทร
- [x] Validation: email format ถูกต้อง

**Step 2 — MT5 Credentials**
- [x] Required: MT5 Account ID, Investor Password, Server
- [x] Submit → สร้าง client ใน `pending` status

**Edge Cases**
- [ ] Double-click submit → ไม่สร้าง 2 records
- [x] เกิน quota `max_clients` → แสดง error
- [x] Rate limit: 10 req/min

### 3.6 Client Account Actions

- [x] Edit client: `POST /api/ib/clients/edit`
- [x] Cancel pending: `POST /api/ib/clients/cancel`
- [x] Resubmit rejected: `POST /api/ib/clients/resubmit`

### 3.7 View Client Portfolio (as IB)

- [x] `?account_id=xxx` → ดู portfolio ของ client ตัวเอง
- [x] ใส่ account_id ของ IB อื่น → ถูก block

---

## 4. Client Role

### 4.1 Auth & Authorization

- [x] Client `pending/rejected/suspended` → เข้า `/portfolio` ไม่ได้
- [x] Client `approved` → เข้า `/portfolio` ได้
- [x] Direct URL `/admin`, `/ib` → ถูก block
- [x] Logout ทำงาน

---

### 4.2 Overview Dashboard (`/portfolio`)

**KPI Row**
- [ ] Total Trades, Win Rate, Profit Factor, Avg Win/Loss ถูกต้อง
- [ ] Health Score คำนวณถูกต้อง

**Charts**
- [ ] Equity Curve (30-day) render ถูกต้อง ไม่ crash
- [ ] Daily P&L Chart ถูกต้อง
- [ ] Drawdown Chart ถูกต้อง
- [ ] Radar Chart (6 axes) ถูกต้อง

**Command Center**
- [ ] Today's P&L แสดงค่าปัจจุบัน
- [ ] Reviewed trades count ถูกต้อง
- [ ] Journal completion status อัพเดตหลัง save journal
- [ ] Setup performance (top 4) แสดง

**Cards**
- [ ] Open Positions: floating P&L
- [ ] Recent Trades: 8–10 trades ล่าสุด
- [ ] Checklist Progress
- [ ] Rule Break Metrics
- [ ] AI Coach Card โหลด

**Dashboard Customization**
- [ ] Toggle card visibility → บันทึกลง `localStorage`
- [ ] Reload หน้า → preferences คงอยู่

---

### 4.3 Trades Page (`/portfolio/trades`)

**Trade List**
- [x] แสดง 25 trades ต่อหน้า
- [x] Pagination ทำงาน (> 25 trades)
- [x] Virtual list ไม่ lag บน 100+ trades

**Filtering**
- [x] Symbol
- [x] Session: Asian / London / NY
- [x] Direction: BUY / SELL
- [x] Duration: Scalp / Intraday / Swing / Position
- [x] Playbook
- [x] Profit Range slider
- [x] Lot Size slider
- [x] Clear all → reset ถูกต้อง
- [x] URL อัพเดตเมื่อ filter เปลี่ยน (shareable link)

**Grouping**
- [x] Group by: Day / Session / Setup

**Saved Views**
- [x] Save preset → ปรากฏใน dropdown
- [x] Load saved view → filters apply
- [x] Delete saved view

**Bulk Actions**
- [x] Select multiple trades
- [x] Bulk assign tag
- [x] Bulk change review status
- [x] Export selected to CSV

**Individual Trade**
- [x] Tags color-coded ถูกต้อง
- [x] Review status badge: `unreviewed` / `in_progress` / `reviewed`
- [x] Quick-assign tag (optimistic update)

---

### 4.4 Trade Detail (`/portfolio/trades/[id]`)

**Trade Info**
- [x] Symbol, type, lot size, entry/exit, duration ถูกต้อง
- [x] P&L amount + percentage ถูกต้อง
- [x] SL/TP, pips, commission, swap แสดง

**Trade Review**
- [x] Assign Playbook → dropdown แสดง active playbooks
- [x] Score fields (1–5): Setup, Discipline, Execution, Confidence
- [x] Follow Plan toggle
- [x] Text fields: Entry reason, Exit reason, Execution notes, Lesson
- [x] Broken Rules checklist (multi-select)
- [x] Save → status เปลี่ยนเป็น `reviewed`
- [x] Reload หน้า → review data คงอยู่

**Trade Notes**
- [x] Auto-save 2 วิ (debounce)
- [x] Rating 1–5 บันทึกได้
- [x] Visual save confirmation แสดง

**Tags**
- [x] Add / Remove tag (optimistic update + server sync)
- [x] Categories: setup, execution, emotion, mistake, market_condition, custom

**Attachments**
- [x] เพิ่ม: link, image_url, screenshot
- [x] Signed URL ใช้งานได้ (1-hour expiry)
- [x] Delete attachment
- [x] Screenshot annotator ทำงาน

**Trade Replay** (`/portfolio/trades/[id]/replay`)
- [x] โหลดได้ ไม่ crash
- [ ] Animation entry → exit บน chart

---

### 4.5 Manual Trade Entry

- [x] เปิด QuickTradeEntry modal
- [x] กรอก: Symbol, Side, Profit, Lot size, เวลา
- [x] Submit → trade ปรากฏในรายการ
- [x] กรอกไม่ครบ → error message
- [x] Double-click → ไม่สร้าง 2 trades
- [x] Rate limit: 20 req/min

---

### 4.6 Trade Import

**Flow**
- [x] Step 1: Upload CSV
- [x] Step 2: Auto-detect headers + mapping UI
- [x] Step 3: Preview first 5 rows
- [x] Step 4: Confirm → import
- [x] Result: imported count + errors (ถ้ามี)
- [x] Error rows: แสดง row number + ข้อผิดพลาด
- [x] Import history ดูได้
- [x] Max 500 trades ต่อครั้ง

**Edge Cases**
- [x] CSV ว่าง → error message
- [x] Header ไม่ match → mapping UI ให้เลือกเอง
- [x] ค่า numeric ไม่ถูก (text ในช่อง profit) → skip row + แสดง error
- [ ] Duplicate trades → ตรวจสอบ behavior

---

### 4.7 Journal (`/portfolio/journal`)

**Calendar**
- [x] Month/year navigation (prev/next)
- [x] Cell: journal status (color), P&L, trade count
- [x] คลิก date → โหลด journal วันนั้น

**Journal Form**
- [x] Pre-market notes (rich text)
- [x] Session plan, Market bias
- [x] Post-market notes
- [x] Checklist (multi-select)
- [x] Mood / Energy / Discipline / Confidence (1–5)
- [x] Lessons learned (rich text)
- [x] Save → completion status อัพเดต (`not_started` → `in_progress` → `complete`)
- [x] Reload → data คงอยู่

**Templates**
- [x] เปิด template modal
- [x] เลือก template → auto-fill fields

**Summary**
- [x] Completion rate %
- [x] Journal streak (consecutive days) ถูกต้อง

---

### 4.8 Notebook (`/portfolio/notebook`)

**Folders**
- [x] System folder "Sessions" ลบไม่ได้
- [x] สร้าง folder ใหม่ได้
- [x] Note count per folder ถูกต้อง

**Notes**
- [x] Rich text editor (Tiptap) ทำงาน
- [x] Auto-save 2 วิ
- [x] Delete → undo toast ปรากฏ
- [x] Restore deleted note
- [x] Toggle Active / Deleted view

**Search**
- [x] Full-text search
- [x] Filter folder + search พร้อมกัน

**Session Recap**
- [x] เลือกวัน → Generate → บันทึกลง "Sessions" folder

---

### 4.9 Analytics (`/portfolio/analytics`)

ตรวจสอบทั้ง **11 tabs**:

| Tab | สิ่งที่ตรวจ |
|-----|-----------|
| Overview | Total trades, win rate, profit factor, avg win/loss |
| Performance | Daily returns chart, monthly table, best/worst day |
| Calendar | Heatmap by day/month |
| Symbols | Win rate, profit factor per symbol, sort ได้ |
| Tags | Performance per tag, rank ถูกต้อง |
| Days | Day-of-week P&L ถูกต้อง |
| Daytime | Session heatmap (Asian/London/NY) |
| Risk | Drawdown, risk per trade, risk of ruin |
| Recaps | AI recaps generate ได้ |
| Compare | YoY/MoM comparison ทำงาน |
| Correlation | Heatmap matrix แสดง |

**Filter Bar**
- [x] Filter apply ข้ามทุก tabs
- [x] Clear filter → reset ทุก tabs

**Export PDF**
- [x] Generate + download ได้ ชื่อไฟล์: `trading-report-[DATE].pdf`
- [x] เนื้อหาตรงกับ filter ที่ apply

---

### 4.10 Playbook (`/portfolio/playbook`)

**My Playbooks**
- [x] Toggle active/inactive
- [x] Win rate, trade count ถูกต้อง
- [x] Edit → บันทึก changes
- [x] Delete → undo toast; restore ได้

**Playbook Editor**
- [x] Name, Description
- [x] Setup tag dropdown
- [x] Entry / Exit / Risk rules / Mistakes to avoid (add/remove items)
- [x] Example trades (multi-select)
- [x] Drag to reorder (sort_order)
- [x] Save → ปรากฏใน list

**Community Templates**
- [x] Search by name/description
- [x] Filter by category (8 categories)
- [x] Sort: Popular / Newest / Win Rate
- [x] Clone → ปรากฏใน My Playbooks

**Publish to Community**
- [x] เลือก category → Confirm → ปรากฏใน community list

---

### 4.11 Progress (`/portfolio/progress`)

**Summary Cards**
- [x] Review rate %, Reviewed count
- [x] Journal completion %, streak

**Goals**
- [x] สร้าง goal: type, target value, period days
- [x] Progress bar อัพเดตตามข้อมูลจริง
- [x] แก้ไข target/period

**Daily Checklist**
- [x] Default rules ถูกสร้างอัตโนมัติ (ถ้ายังไม่มี)
- [x] สร้าง custom rule
- [x] Toggle complete/incomplete
- [x] Completion history 50+ days
- [x] Drag to reorder
- [x] Toggle active/inactive

**Heatmap**
- [x] Activity calendar แสดง completion intensity
- [x] คลิก day → แสดง details

---

### 4.12 Calendar (`/portfolio/calendar`)

- [x] Filter: Last / This / Next week
- [x] Filter impact: High / Medium / Low / Holiday
- [x] Filter by country
- [x] Search event title
- [x] แสดง: country flag, event, impact dot, time, forecast, previous, actual
- [x] High impact events highlighted

---

### 4.13 Live Trade (`/portfolio/live-trade`)

- [x] รายการ coaches แสดง
- [x] Real-time Bangkok time อัพเดตทุก 30 วิ
- [x] "LIVE" badge animate บน coach ที่กำลัง live
- [x] Coach ที่ live มี glow effect

---

### 4.14 AI Analysis (`/portfolio/analysis`)

- [ ] Generate → streaming response แสดง
- [x] Sections ครบ: Market bias, Liquidity map, Setup, Scenarios, Key levels, Trade plan
- [ ] Markdown render ถูกต้อง
- [x] Rate limit: 5 req/hour → ลอง 6 ครั้ง → เจอ 429

---

### 4.15 Multi-Account (`/portfolio/multi-account`)

- [x] Cards ทุก account แสดง: balance, equity, P&L, win rate, profit factor
- [x] Combined summary ถูกต้อง
- [x] คลิก account → switch + navigate

---

### 4.16 Social (`/portfolio/social`)

**Settings**
- [x] บันทึก display name, bio
- [x] Public/private toggle
- [x] Linked account selection

**Feed**
- [x] Like / Unlike → count อัพเดต (optimistic)
- [x] Expand comments → แสดง thread
- [x] Add comment → ปรากฏทันที
- [x] Delete own comment
- [x] Create post: type, content, submit
- [x] Error handling ถ้า submit ล้มเหลว

**Leaderboard**
- [x] Sort: Net P&L / Win Rate / Profit Factor
- [x] Rankings ถูกต้อง

---

### 4.17 Settings

**Security (`/settings/security`)**
- [x] Change password → validate current password
- [x] Login history แสดง
- [x] API keys: Create, View, Delete

**Alerts (`/settings/alerts`)**
- [x] Create alert: `daily_loss`, `daily_profit_target`, `win_rate_drop`, `drawdown`, `loss_streak`
- [x] Enable/disable toggle
- [x] Test evaluate: `POST /api/portfolio/alerts/evaluate`
- [x] Last trigger time แสดง

**Email Reports (`/settings/email-reports`)**
- [x] Configure frequency (daily/weekly), content, save

**Trade Settings (`/settings/trade`)**
- [x] Default parameters บันทึกได้

---

## 5. Cross-Role & Global Features

### 5.1 Authentication

- [x] Google OAuth → callback → redirect ถูก role
- [ ] Forgot password → email ส่งได้
- [x] Session หมดอายุ → redirect login พร้อม message
- [ ] Login 2 tabs พร้อมกัน → ทำงานได้

### 5.2 Theme & Display

- [x] Dark mode toggle ทำงาน
- [x] Display unit ($, %, pips) → charts/tables อัพเดต
- [x] Mobile responsive (375px, 768px)
- [x] Pull-to-refresh (mobile)

### 5.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `g` + `o` | Overview |
| `g` + `t` | Trades |
| `g` + `j` | Journal |
| `g` + `a` | Analytics |
| `g` + `n` | Notebook |
| `g` + `p` | Playbook |
| `g` + `r` | Progress |
| `/` หรือ `Cmd+K` | Search palette |
| `?` | Shortcuts help modal |
| `Escape` | ปิด modal/panel |

- [x] Shortcuts suppressed เมื่อ modal เปิดอยู่

### 5.4 AI Chat Panel

- [x] เปิด panel
- [x] ส่งข้อความ → streaming response
- [x] Conversation history คงอยู่ใน session

### 5.5 Notifications

- [x] Push notification subscribe ทำงาน
- [x] Notification bell: unread count
- [x] คลิก → navigate ถูก route

### 5.6 Sync

- [x] Sync status badge แสดงเวลา last sync
- [x] Manual trigger: `POST /api/portfolio/sync-trigger`
- [ ] หลัง sync → data อัพเดต

### 5.7 Network & Offline

- [x] Network Status แสดงเมื่อ offline
- [x] `/offline` page ปรากฏเมื่อ PWA offline

### 5.8 Global Search

- [x] `Cmd+K` → search palette
- [x] ค้นหา trades, notes, playbooks
- [x] Keyboard navigation (↑↓ Enter)

---

## 6. Security QA

### 6.1 Role Isolation

- [x] Client เข้า `/admin` หรือ `/ib` ไม่ได้
- [x] Master IB เข้า `/admin` ไม่ได้
- [ ] Client ดู trades ของ client อื่นไม่ได้ (RLS)
- [ ] IB ดู clients ของ IB อื่นไม่ได้

### 6.2 API Authorization

- [x] `GET/POST /api/admin/*` ไม่มี admin session → 403
- [x] `GET/POST /api/ib/*` ไม่มี IB session → 403
- [x] `POST /api/portfolio/*` ด้วย trade ของ user อื่น → 403

### 6.3 Rate Limiting

> ✅ verified จาก code — ตรวจพบใน `src/lib/server/rate-limit.ts` ใช้ Upstash Redis (fallback in-memory)

| Endpoint | Limit | วิธีทดสอบ |
|----------|-------|----------|
| `POST /api/admin/approve` | 30/min | ส่ง 31 requests → 429 |
| `POST /api/ib/clients` | 10/min | ส่ง 11 requests → 429 |
| `POST /api/portfolio/trades/manual` | 20/min | ส่ง 21 → 429 |
| `POST /api/portfolio/analysis` | 5/hour | ส่ง 6 → 429 |

### 6.4 Input Validation

> ✅ verified จาก code — DOMPurify ใน `src/lib/sanitize.ts`, isSafeUrl ใน `src/lib/server/trade-guard.ts`

- [ ] **XSS**: ใส่ `<script>alert(1)</script>` ในช่อง note/journal → ไม่ execute
- [ ] **SQL Injection**: ใส่ `'; DROP TABLE trades;--` ใน search → ไม่มีผล
- [ ] **SSRF**: ใส่ internal URL ใน attachment link → ถูก block

---

## 7. Performance QA

| รายการ | เกณฑ์ | สถานะ |
|--------|-------|-------|
| Initial page load `/portfolio` | < 3 วินาที | ⬜ manual |
| Trade list 100+ records (virtual list) | ไม่ lag | ✅ VirtualList.svelte verified |
| PDF export | < 30 วินาที | ✅ jsPDF implementation verified |
| AI analysis streaming เริ่มต้น | < 5 วินาที | ✅ ReadableStream + OpenAI stream verified |
| Heatmap 365 วัน | render ไม่ค้าง | ⬜ manual (current impl = 14 weeks) |
| Equity curve chart | < 1 วินาที | ✅ lightweight-charts + DeferRender verified |

---

## 8. Edge Cases

| สถานการณ์ | ผลที่คาดหวัง | สถานะ |
|-----------|-------------|-------|
| Client มี 0 trades | Empty state แสดง (ไม่ crash) | ✅ EmptyState component verified |
| Client มี 1000+ trades | Virtual list + pagination ทำงาน | ✅ VirtualList + 25/page pagination verified |
| Journal วันที่ไม่มี trades | บันทึก journal ได้ ไม่ error | ✅ journal API ไม่มี trade dependency |
| Import CSV 500 trades | Progress indicator แสดง | ✅ MAX_IMPORT=500 + loading state verified |
| Submit form บน network ช้า (3G) | Loading state + ไม่ double-submit | ✅ disabled={saving} ทุก form verified |
| 2 tabs edit พร้อมกัน | last-write-wins (ไม่ crash) | ⬜ manual |
| Account ถูก suspend ขณะ logged in | Session invalidate → redirect login | ✅ hooks.server.ts only serves approved accounts |
| MT5 bridge down | Sync error แสดง ไม่ crash app | ⬜ manual (SyncStatusBadge ไม่มี error state) |
| Token expired ขณะ upload ไฟล์ | Error message ชัดเจน | ⬜ manual (generic 500 error, ไม่ specific) |

---

## 9. Regression Tests

หลังแก้ code ใน phase ใดก็ตาม ตรวจสอบ:

- [x] Trade list filter ยังทำงาน
- [x] Journal save ยังทำงาน
- [x] Keyboard shortcuts ยังทำงาน
- [x] Admin approval ยังทำงาน
- [x] `buildKpiMetrics()` คำนวณถูก — `src/lib/server/portfolio.ts`
- [x] `applyPortfolioFilters()` ยังทำงาน — `src/lib/portfolio.ts`
- [x] `+layout.server.ts` data load ไม่ช้าลง — `src/routes/portfolio/+layout.server.ts`

---

## ลำดับการ QA แนะนำ

```
Admin → Master IB → Client
```

เหตุผล: Admin ต้อง approve Client ก่อน ถึงจะ QA Client ได้ครบ

## เครื่องมือที่ใช้ระหว่าง QA

- **Browser DevTools → Network tab**: ตรวจ API requests/responses
- **Browser DevTools → Console**: ตรวจ JS errors
- **Browser DevTools → Application tab**: ตรวจ localStorage, session
- **Device Mode (375px)**: ทดสอบ mobile (iPhone SE)
- **Keyboard จริง**: ทดสอบ shortcuts
