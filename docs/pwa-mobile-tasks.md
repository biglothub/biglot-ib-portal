# PWA Mobile Tasks (iPhone + Android)

วันที่จัดทำ: 3 พฤษภาคม 2026
อ้างอิงแผน: `docs/pwa-iphone-ui-ux-plan.md`

เอกสารนี้แตก plan ข้างต้นออกเป็น task ระดับลงมือเขียนโค้ดได้ โดยมีข้อบังคับสำคัญหนึ่งข้อ:

> **ทุก task ต้องไม่กระทบหน้า desktop (viewport ≥ 768px)** — ผู้ใช้ที่เปิดเว็บด้วย laptop/desktop ต้องเห็น UI เดิมเป๊ะ ไม่มี layout shift, ไม่มี component ใหม่โผล่, ไม่มี side effect ที่ทำให้ feature เดิมพัง

## Mobile Isolation Rules (อ่านก่อนทุก task)

ใช้กติกา 7 ข้อนี้เป็นหลัก

1. **Breakpoint guard**: feature ใหม่ทุกตัวต้องอยู่ใต้ `md:hidden` (Tailwind `< 768px`) หรือ media query `@media (max-width: 767px)` หรือ runtime check `matchMedia('(max-width: 767px)')`
2. **Standalone guard**: feature ที่เกี่ยวกับ PWA shell (safe-area, back affordance, install) ต้องเช็คเพิ่มว่า `display-mode: standalone` หรือ `navigator.standalone === true` ก่อน apply
3. **CSS scoping**: ห้ามแก้ utility class ที่ใช้ทั้ง mobile + desktop เช่น `bg-dark-bg`, `text-base` ถ้าต้องเพิ่ม style ใหม่ให้ใช้ class ใหม่ หรือ media query wrapper
4. **Component duplication over conditional**: ถ้า component เดียวต้องเปลี่ยน layout เยอะ ให้ render สอง variant แยก (`<DesktopX class="hidden md:block">` + `<MobileX class="md:hidden">`) แทนการใส่ `if` ภายใน
5. **Server load ไม่เปลี่ยน shape**: ห้ามแก้ return type ของ `+layout.server.ts` หรือ `+page.server.ts` ที่ desktop ใช้ จะเพิ่ม field ใหม่ได้ แต่ห้ามลบ/rename
6. **Service worker changes opt-in by route**: ถ้าเพิ่ม cache strategy ใหม่ ต้อง scope ด้วย URL pattern ไม่ใช่ blanket — desktop ใช้ flow เดิม
7. **No global state mutation**: PWA-related store (draft queue, sync state) อยู่ใน `src/lib/pwa/*` แยกต่างหาก ไม่ผสมกับ store เดิม

ทุก task ด้านล่างมี field `Desktop isolation` อธิบายว่าทำตามกติกาข้อไหน

---

## Phase 0 — Foundation & Audit

### TASK-001 — สร้าง mobile detection utility
- **Why**: หลาย task ต้องเช็ค viewport + standalone ซ้ำ ๆ ควรมี util เดียว
- **Files**:
  - สร้างใหม่: `src/lib/pwa/platform.ts`
  - สร้างใหม่: `src/lib/pwa/use-platform.svelte.ts`
- **Steps**:
  1. Export `isStandalone()`: รวม `display-mode: standalone` + `navigator.standalone`
  2. Export `isIOS()`, `isAndroid()`, `isMobile()` จาก userAgent + viewport
  3. Export `usePlatform()` Svelte 5 rune ที่ subscribe `matchMedia` change
  4. Export type `PlatformInfo` ที่ component อื่นใช้ร่วมกัน
- **Desktop isolation**: utility อย่างเดียว ไม่ render — desktop เรียกแล้วได้ `isMobile=false` กลับมา feature ที่ guard ด้วย flag นี้จะไม่ทำงาน
- **Acceptance**:
  - `npx svelte-check` ผ่าน
  - SSR ไม่ crash (window check ครบ)
  - Desktop browser console เรียก `isMobile()` ได้ค่า `false`
- **Size**: S | **Priority**: P0

### TASK-002 — Audit baseline screenshots ทุก viewport
- **Why**: ต้องมี baseline ก่อนแก้ จะ regression check ได้
- **Files**: ไม่แก้โค้ด — สร้าง `docs/pwa-audit/` เก็บ screenshot
- **Steps**:
  1. ถ่าย screenshot viewport 320, 375, 390, 430, 768, 1280px ของหน้า: portfolio, trades, journal, analytics, login
  2. ถ่ายทั้ง Safari mode + standalone mode บน iPhone
  3. Run Lighthouse PWA + Accessibility บน Chrome mobile emulation
  4. บันทึก issue ใน `docs/pwa-audit/issues.md` แยก severity
- **Desktop isolation**: read-only audit
- **Acceptance**: มี screenshot 6 viewport × 5 หน้า + Lighthouse JSON + issue list
- **Size**: M | **Priority**: P0

### TASK-003 — Define z-index + safe-area constants
- **Why**: ป้องกัน layer ทับซ้อน (banner ทับ modal, FAB ทับ bottom nav)
- **Files**:
  - แก้: `src/app.css` — เพิ่ม CSS variable block scoped `@media (max-width: 767px)`
  - สร้างใหม่: `src/lib/pwa/z-index.ts` — export const map
- **Steps**:
  1. กำหนด z-index map: `offlineBanner: 60`, `modal: 50`, `bottomSheet: 40`, `toast: 35`, `fab: 30`, `bottomNav: 20`, `header: 15`
  2. กำหนด safe-area utility class: `.pwa-safe-top`, `.pwa-safe-bottom`, `.pwa-safe-x`
  3. Class เหล่านี้ใส่ `padding` แค่ใน standalone mode + mobile viewport เท่านั้น
- **Desktop isolation**: media query `@media (max-width: 767px) and (display-mode: standalone)` — desktop ไม่โดน padding เพิ่ม
- **Acceptance**:
  - Desktop browser inspect: `--safe-top` = 0 หรือไม่ apply
  - iPhone standalone: `--safe-top` ≥ 44px
- **Size**: S | **Priority**: P0

---

## Phase 1 — Install UX (iPhone + Android)

### TASK-101 — Refactor InstallPrompt state machine
- **Files**: `src/lib/components/layout/InstallPrompt.svelte`
- **Steps**:
  1. แยก state เป็น `'eligible' | 'snoozed' | 'installed' | 'unsupported' | 'dismissed'`
  2. เก็บ `installPromptDismissedAt` ใน `localStorage` key `pwa.install.dismissedAt`
  3. Snooze period 7 วันตาม pattern เดิม
  4. ใช้ `usePlatform()` จาก TASK-001 แทน inline detection
- **Desktop isolation**: component import แล้วเช็ค `isMobile()` ที่ root — desktop return `null`
- **Acceptance**: desktop ไม่เห็น sheet, snooze ใช้ได้, standalone mode hide
- **Size**: S | **Priority**: P0

### TASK-102 — iOS guided install bottom sheet
- **Files**: `src/lib/components/layout/InstallPrompt.svelte` + เพิ่ม `src/lib/components/pwa/IOSInstallSteps.svelte`
- **Steps**:
  1. Sheet มี 3 step chip: `1 กดแชร์`, `2 เพิ่มในหน้าจอโฮม`, `3 เปิดจากไอคอน IB Portal`
  2. Visual: SVG icon ปุ่ม share + home screen icon
  3. Title: `เพิ่ม IB Portal ลงหน้าจอโฮม`
  4. Body: `เปิดดูพอร์ตได้เร็วขึ้น และรับการแจ้งเตือนสำคัญ`
  5. Action `ไว้ทีหลัง` + `ติดตั้งเลย` (auto-trigger Android prompt ถ้าเป็น Android)
- **Desktop isolation**: ใช้ใน InstallPrompt.svelte ที่ guard `isMobile()` แล้ว
- **Acceptance**: Safari iOS เห็น guide, desktop ไม่เห็น, copy ไม่อ้างว่าติดตั้งอัตโนมัติ
- **Size**: M | **Priority**: P0

### TASK-103 — Android `beforeinstallprompt` capture
- **Files**: `src/lib/components/layout/InstallPrompt.svelte` + `src/lib/pwa/install-event.svelte.ts`
- **Steps**:
  1. Capture `beforeinstallprompt` event และเก็บใน rune store
  2. ปุ่ม `ติดตั้งเลย` เรียก `prompt()` แล้ว track outcome
  3. ถ้า outcome = `accepted` → mark `installed`, hide forever
- **Desktop isolation**: `beforeinstallprompt` ก็ยิงบน desktop Chrome ได้ ดังนั้นต้อง guard ด้วย `isMobile()` ก่อนแสดงปุ่ม
- **Acceptance**: Android Chrome เห็นปุ่มทำงาน, desktop Chrome ไม่เห็น
- **Size**: S | **Priority**: P0

### TASK-104 — Persistent install entry ใน More menu
- **Files**: `src/lib/components/layout/MobileNav.svelte` (More drawer section)
- **Steps**:
  1. เพิ่ม row `ติดตั้งแอป` ใน More drawer
  2. กดแล้วเปิด install sheet ใหม่ (bypass snooze)
  3. ซ่อน row นี้ถ้า `isStandalone()` = true
- **Desktop isolation**: MobileNav.svelte เป็น mobile-only อยู่แล้ว (`md:hidden`)
- **Acceptance**: ผู้ใช้ที่ dismiss แล้วยังเปิด guide ได้
- **Size**: S | **Priority**: P1

### TASK-105 — Verify manifest + start_url strategy
- **Files**: `static/manifest.json`, `src/hooks.server.ts` (อาจ)
- **Steps**:
  1. ทดสอบ `start_url: "/"` vs `"/portfolio"`
  2. ถ้าใช้ `/` ต้องมี server redirect logged-in client ไป `/portfolio`
  3. เพิ่ม query `?source=pwa` เพื่อ track Home Screen launch
- **Desktop isolation**: manifest ใช้กับ install บน Chrome desktop ก็ได้ — redirect logic ต้องเช็ค session ก่อน ไม่ทำให้ desktop loop
- **Acceptance**: launch จาก Home Screen ลง `/portfolio` โดยตรง, desktop เปิด `/` ปกติ
- **Size**: S | **Priority**: P1

---

## Phase 2 — Standalone App Shell

### TASK-201 — Mobile-only safe-area utilities
- **Files**: `src/app.css`
- **Steps**:
  1. เพิ่ม class `.pwa-safe-top`, `.pwa-safe-bottom`, `.pwa-safe-x` (จาก TASK-003)
  2. Class ถูก gate ด้วย `@media (max-width: 767px)` + `@media (display-mode: standalone)` ซ้อนกัน
  3. เพิ่ม `.pwa-min-touch` = `min-height: 44px; min-width: 44px`
- **Desktop isolation**: media query ป้องกัน — desktop ที่กว้าง ≥ 768px ไม่เห็น padding
- **Acceptance**: inspect บน desktop ไม่มี extra padding
- **Size**: S | **Priority**: P0

### TASK-202 — Mobile-only header pattern
- **Files**:
  - สร้างใหม่: `src/lib/components/pwa/MobileHeader.svelte`
  - แก้: `src/routes/portfolio/+layout.svelte`
- **Steps**:
  1. Component รับ `title`, `back?: () => void`, `actions?: Snippet`
  2. ใส่ `pwa-safe-top` + sticky position
  3. แสดงเฉพาะ `md:hidden`
  4. ใน portfolio layout: render header แค่ใน mobile, desktop ใช้ Sidebar เดิม
- **Desktop isolation**: wrapper `<div class="md:hidden">` — desktop layout ไม่เปลี่ยน
- **Acceptance**: desktop ไม่เห็น header เพิ่ม, mobile เห็น header sticky
- **Size**: M | **Priority**: P0

### TASK-203 — Detail page back affordance
- **Files**:
  - `src/routes/portfolio/trades/[id]/+page.svelte`
  - `src/routes/portfolio/playbook/**/*.svelte`
  - `src/routes/portfolio/journal/+page.svelte`
- **Steps**:
  1. ใช้ `MobileHeader` (TASK-202) มี back button เรียก `history.back()`
  2. Fallback ถ้าไม่มี history: route ไป `/portfolio`
  3. ปุ่ม back มี aria-label `ย้อนกลับ`
- **Desktop isolation**: header render `md:hidden` — desktop ใช้ navigation เดิมจาก Sidebar
- **Acceptance**: standalone mode iPhone กด back ทำงานได้, desktop ไม่เห็นปุ่ม back
- **Size**: M | **Priority**: P1

### TASK-204 — Refine MobileNav z-index + safe-area
- **Files**: `src/lib/components/layout/Sidebar.svelte`, `MobileNav.svelte`
- **Steps**:
  1. Apply `pwa-safe-bottom` + z-index ตาม map
  2. ตรวจ active state มี contrast + label
  3. Touch target ≥ 44px ทุกปุ่ม
- **Desktop isolation**: MobileNav `md:hidden` แล้ว
- **Acceptance**: iPhone home indicator ไม่บัง, ทุกปุ่ม 44px+
- **Size**: S | **Priority**: P0

### TASK-205 — More drawer grouped actions
- **Files**: `src/lib/components/layout/MobileNav.svelte`
- **Steps**:
  1. แยก section: `Tools` (Calendar/Replay/AI/Search), `Account` (Settings/Alerts/Guide), `System` (Install/Sync/Logout)
  2. Bottom sheet มี handle, swipe-down close, backdrop click close, focus trap
  3. `aria-modal="true"`, `role="dialog"`
- **Desktop isolation**: drawer trigger ปุ่ม More อยู่ใน MobileNav (md:hidden)
- **Acceptance**: a11y check ผ่าน, swipe-down ปิดได้, body scroll lock ขณะเปิด
- **Size**: M | **Priority**: P1

---

## Phase 3 — Offline Read UX

### TASK-301 — Enhanced offline banner copy + timestamp
- **Files**: `src/lib/components/shared/NetworkStatus.svelte`
- **Steps**:
  1. เพิ่ม state `online`, `offline`, `reconnecting`, `cached` (online แต่ใช้ stale cache)
  2. Copy offline: `ออฟไลน์ - กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด <HH:mm>`
  3. ถ้ามี pending sync แสดงปุ่ม `ดูรายการรอซิงก์`
  4. `aria-live="polite"`
- **Desktop isolation**: banner เดิมใช้ทั้งสองแพลตฟอร์ม — เพิ่ม content ไม่เปลี่ยน layout desktop, ตรวจว่าไม่ overflow ใน sidebar
- **Acceptance**: desktop เห็น banner เหมือนเดิมแต่ copy ดีขึ้น, mobile เห็น timestamp
- **Size**: M | **Priority**: P0

### TASK-302 — Last updated indicator บน portfolio cards
- **Files**:
  - `src/routes/portfolio/+page.svelte`
  - `src/lib/components/portfolio/KpiCard.svelte` (ถ้ามี)
- **Steps**:
  1. เพิ่ม small text `อัปเดตล่าสุด HH:mm` ใต้ card title (mobile only)
  2. ถ้า offline: เปลี่ยนเป็น `บันทึกไว้ HH:mm` + icon cloud-off
- **Desktop isolation**: text element ใส่ class `md:hidden`
- **Acceptance**: desktop card layout ไม่เปลี่ยน
- **Size**: M | **Priority**: P1

### TASK-303 — Improve `/offline` page
- **Files**: `src/routes/offline/+page.svelte`
- **Steps**:
  1. แสดง last visited route (เก็บใน localStorage `pwa.lastRoute`)
  2. ปุ่ม `ลองเชื่อมต่อใหม่` พยายาม fetch `/api/health` แล้วถ้า ok navigate กลับ
  3. ลิงก์ไปหน้า cached: portfolio overview ถ้ามี
- **Desktop isolation**: หน้า /offline แสดงทุก viewport — แค่ปรับเนื้อหา ไม่กระทบ desktop layout
- **Acceptance**: offline page ใช้ได้บนทั้งสองแพลตฟอร์ม
- **Size**: S | **Priority**: P1

### TASK-304 — Service worker cache scoping audit
- **Files**: `src/service-worker.ts`
- **Steps**:
  1. List ทุก fetch handler — ตรวจว่า API call (Supabase, /api/*) ไม่ถูก cache โดยไม่ตั้งใจ
  2. Auth-related URL ต้อง bypass cache เสมอ
  3. เพิ่ม comment ระบุ cache strategy ของแต่ละ pattern
- **Desktop isolation**: SW ทำงานทุก client — การแก้นี้แค่ป้องกัน bug ไม่เปลี่ยน behavior parent
- **Acceptance**: desktop login ยัง flow เดิม, ไม่มี stale auth
- **Size**: M | **Priority**: P0

---

## Phase 4 — Offline Drafts & Pending Sync

> **Pre-requisite**: ต้องตอบ Open Decisions ของ plan ก่อน — โดยเฉพาะ "manual trade entry offline?" และ "Sync Center: sheet/page/both?"

### TASK-401 — IndexedDB foundation
- **Files**: สร้างใหม่ `src/lib/pwa/offline-db.ts`
- **Steps**:
  1. ใช้ `idb` library (npm install) wrap IndexedDB
  2. Database name: `ib-portal-pwa-v1`
  3. Stores:
     ```ts
     drafts:    { id (uuid), type: 'journal'|'review'|'note', entityId: string, payload: Json, updatedAt: number, version: number }
     pending:   { id (uuid), endpoint: string, method: string, body: Json, headers: Json, createdAt: number, attempts: number, lastError?: string, idempotencyKey: string }
     snapshots: { route: string, data: Json, capturedAt: number }
     ```
  4. Migrations: version-bump strategy
- **Desktop isolation**: เปิด IndexedDB ทุก browser ได้ แต่ caller (draft autosave) ต้อง gate ด้วย `isMobile()` ในเฟสแรก
- **Acceptance**: open/close DB ผ่าน, schema upgrade ทดสอบได้
- **Size**: M | **Priority**: P0

### TASK-402 — Draft autosave hook
- **Files**: สร้างใหม่ `src/lib/pwa/use-draft.svelte.ts`
- **Steps**:
  1. Rune `useDraft(type, entityId)` คืน `{ value, save, clear, status }`
  2. Debounce save 800ms
  3. Load draft ตอน mount, merge กับ server data ตาม `updatedAt` (last-write-wins ในเฟสแรก)
- **Desktop isolation**: hook gate ด้วย `isMobile()` หรือ feature flag — desktop เขียน draft ไป server โดยตรงตามเดิม
- **Acceptance**: ปิดแอปแล้วเปิดใหม่ draft ยังอยู่
- **Size**: M | **Priority**: P0

### TASK-403 — Wire draft autosave: Journal
- **Files**: `src/routes/portfolio/journal/+page.svelte` + journal form components
- **Steps**:
  1. ใช้ `useDraft('journal', dateKey)` ใน mobile
  2. แสดง badge `แบบร่าง · ยังไม่บันทึก` ถ้า draft ต่างจาก server
  3. ปุ่ม `ล้างแบบร่าง`
- **Desktop isolation**: ตรวจ `isMobile()` ก่อน mount — desktop ไม่เปลี่ยน
- **Acceptance**: mobile draft survive reload, desktop flow เดิม
- **Size**: M | **Priority**: P1

### TASK-404 — Wire draft autosave: Trade review
- **Files**: `src/routes/portfolio/trades/[id]/+page.svelte` + review form
- **Steps**: คล้าย TASK-403 แต่ entityId = tradeId
- **Desktop isolation**: เหมือน TASK-403
- **Acceptance**: mobile draft per trade, desktop ไม่เปลี่ยน
- **Size**: M | **Priority**: P1

### TASK-405 — Sync queue engine
- **Files**: สร้างใหม่ `src/lib/pwa/sync-queue.ts`
- **Steps**:
  1. `enqueue(action)` — push to `pending` store, สร้าง idempotencyKey (uuid)
  2. `flush()` — loop pending, fetch ตาม endpoint+method, ส่ง `Idempotency-Key` header
  3. Retry: exponential backoff [1s, 5s, 30s, 2m, 10m], max 5 attempts
  4. Trigger `flush()` เมื่อ: online event, app focus, manual button
  5. Emit event `sync:progress`, `sync:complete`, `sync:error` ผ่าน BroadcastChannel
- **Desktop isolation**: queue เก็บ local — caller ต้อง gate ก่อน enqueue
- **Acceptance**: simulate offline → mutate → online → mutation ส่งสำเร็จ + idempotent
- **Size**: L | **Priority**: P0

### TASK-406 — Allowlist endpoint config
- **Files**: สร้างใหม่ `src/lib/pwa/sync-allowlist.ts`
- **Steps**:
  1. List endpoint ที่ queue ได้:
     ```ts
     export const ALLOWLIST = [
       { method: 'POST',  pattern: /^\/api\/portfolio\/journal$/ },
       { method: 'PATCH', pattern: /^\/api\/portfolio\/trades\/[^/]+\/review$/ },
       { method: 'POST',  pattern: /^\/api\/portfolio\/notes$/ },
     ]
     ```
  2. ห้าม: DELETE *, admin/*, approval/*
  3. `canQueue(req)` helper
- **Desktop isolation**: pure config
- **Server**: ทุก endpoint ใน allowlist ต้องรองรับ `Idempotency-Key` header (TASK-407)
- **Acceptance**: unit test cover ทั้ง allow + deny
- **Size**: S | **Priority**: P0

### TASK-407 — Server: Idempotency-Key support
- **Files**: API endpoint files + อาจสร้าง `src/lib/server/idempotency.ts`
- **Steps**:
  1. Middleware/helper เก็บ key + response ใน table `idempotency_records` (Supabase)
  2. TTL 24 ชม.
  3. ถ้า key ซ้ำ + payload hash ตรง → return cached response
  4. ถ้า key ซ้ำ + payload ต่าง → 409
- **Desktop isolation**: header optional — desktop ไม่ส่งก็ทำงานเดิม
- **Migration**: เพิ่ม table ผ่าน Supabase migration ใหม่
- **Acceptance**: integration test: ส่งซ้ำได้คำตอบเดิม
- **Size**: M | **Priority**: P0

### TASK-408 — Sync Center bottom sheet
- **Files**: สร้างใหม่ `src/lib/components/pwa/SyncCenter.svelte`
- **Steps**:
  1. Sheet เปิดจาก More drawer + offline banner action
  2. Section: Last sync, Pending list (with retry), Failed list, Cached pages count, Clear cache button
  3. Subscribe BroadcastChannel จาก TASK-405
- **Desktop isolation**: เรียกจาก mobile-only entry — wrapper `md:hidden`
- **Acceptance**: เห็น pending count, retry ใช้ได้, clear cache ทำงาน
- **Size**: L | **Priority**: P1

### TASK-409 — Pending sync badge
- **Files**: `src/lib/components/layout/MobileNav.svelte`
- **Steps**:
  1. แสดง badge สีแดงบน More icon ถ้า pending > 0
  2. Subscribe sync queue store
- **Desktop isolation**: MobileNav md:hidden
- **Acceptance**: pending=0 ไม่มี badge, pending=3 badge `3`
- **Size**: S | **Priority**: P1

### TASK-410 — Conflict resolution UX
- **Files**: `src/lib/components/pwa/ConflictDialog.svelte`
- **Steps**:
  1. ถ้า server return 409 ในระหว่าง flush → เปิด dialog
  2. แสดง local vs server diff
  3. Action: keep local / keep server / merge manually
- **Desktop isolation**: dialog เรียกจาก sync queue เท่านั้น (mobile flow)
- **Acceptance**: simulate conflict, user เลือกได้
- **Size**: M | **Priority**: P2

---

## Phase 5 — Push Notifications & Badge

### TASK-501 — Contextual permission prompt
- **Files**: `src/lib/components/layout/PushPermission.svelte` (ถ้ามี) + `src/lib/pwa/push.ts`
- **Steps**:
  1. ลบการขอ permission ทันทีหลัง login
  2. ขอเฉพาะหลัง user gesture: ตั้ง alert, เปิด Settings > Notifications, accept journal reminder
  3. ถ้า denied: บันทึก timestamp, อย่าขอใหม่ภายใน 30 วัน
- **Desktop isolation**: contextual prompt ทำงานทั้งสองแพลตฟอร์ม — แต่ทุก trigger ต้องเป็น user click ไม่มี auto popup ให้เกิดต่อ desktop user
- **Acceptance**: ปฏิเสธแล้วไม่ถามซ้ำ, opt-in flow ผ่าน
- **Size**: M | **Priority**: P1

### TASK-502 — Notification categories + Settings toggle
- **Files**:
  - `src/routes/settings/+page.svelte`
  - DB: เพิ่ม table `user_notification_prefs` หรือ JSONB column ใน `profiles`
  - `src/lib/server/push.ts`
- **Steps**:
  1. Categories: `sync_status`, `risk_threshold`, `account_status`, `journal_reminder`, `ai_insight`
  2. Settings UI: toggle per category + master switch
  3. Server เคารพ pref ก่อนส่ง push
- **Desktop isolation**: Settings page รองรับทั้งสอง — การเพิ่ม section ต้อง responsive (มี md:grid layout)
- **Migration**: SQL migration ใหม่
- **Acceptance**: toggle off แล้ว push ไม่มา, on แล้วมา
- **Size**: M | **Priority**: P1

### TASK-503 — Push payload contract
- **Files**: `src/lib/server/push.ts` + `src/service-worker.ts`
- **Steps**:
  1. Payload schema:
     ```ts
     { category, title, body, url: string, badge?: number, icon?: string, tag?: string, data?: Json }
     ```
  2. SW validate + show notification ทุกครั้งที่รับ push (iOS requirement)
  3. Click → URL validator (same-origin), fallback `/portfolio`
- **Desktop isolation**: payload contract ใช้ทุกแพลตฟอร์ม — ไม่กระทบ desktop ที่ subscribe
- **Acceptance**: schema validation ใน SW, click route ถูกต้อง
- **Size**: M | **Priority**: P1

### TASK-504 — App badge policy
- **Files**: `src/lib/pwa/badge.ts`
- **Steps**:
  1. ใช้ `navigator.setAppBadge(n)` เมื่อรองรับ
  2. Counter = unread notifications + pending sync ที่ failed
  3. `clearAppBadge()` เมื่อเปิด notification center หรืออ่านครบ
- **Desktop isolation**: feature detect — Chrome desktop รองรับเหมือนกัน safe
- **Acceptance**: badge เพิ่ม/ลด ตรงตาม state
- **Size**: S | **Priority**: P2

---

## Phase 6 — Forms, Sheets, Gestures

### TASK-601 — Mobile-safe input baseline
- **Files**: `src/app.css` + form components
- **Steps**:
  1. Add CSS: `@media (max-width: 767px) { input, textarea, select { font-size: 16px; } }`
  2. ปุ่ม submit `pwa-min-touch`
  3. Error message ใต้ field, สี + icon ไม่พึ่งสีเดียว
- **Desktop isolation**: scoped media query
- **Acceptance**: focus iOS Safari ไม่ zoom, desktop font เดิม
- **Size**: S | **Priority**: P0

### TASK-602 — Keyboard-aware bottom sheet utility
- **Files**: สร้างใหม่ `src/lib/components/pwa/BottomSheet.svelte`
- **Steps**:
  1. Listen `visualViewport` resize
  2. Adjust sheet `bottom` ตาม keyboard height
  3. Backdrop, swipe-down close, focus trap, ESC close
  4. `pwa-safe-bottom`
- **Desktop isolation**: component md:hidden + render เฉพาะ mobile call site
- **Acceptance**: focus input → sheet เลื่อนตาม keyboard, ปุ่ม submit ไม่ถูกบัง
- **Size**: M | **Priority**: P0

### TASK-603 — Quick trade entry mobile pass
- **Files**: `src/lib/components/portfolio/QuickTradeEntry.svelte`
- **Steps**:
  1. ใช้ BottomSheet (TASK-602) บน mobile
  2. แตก section: Required, Advanced, Notes
  3. Date/time native input + preset chip (`วันนี้`, `เมื่อวาน`)
- **Desktop isolation**: render BottomSheet เฉพาะ mobile, desktop ใช้ modal เดิม
- **Acceptance**: mobile กรอกง่าย, desktop modal ไม่เปลี่ยน
- **Size**: M | **Priority**: P1

### TASK-604 — Pull-to-refresh wrapper
- **Files**: สร้างใหม่ `src/lib/components/pwa/PullToRefresh.svelte`
- **Steps**:
  1. Detect touch start ที่ scrollTop=0
  2. Threshold 80px → trigger callback
  3. Visual: spinner + chevron
  4. Disable ใน chart/table ที่ pan ภายใน
- **Desktop isolation**: wrapper render `md:hidden` slot — desktop เห็น content ตรง ๆ ผ่าน fallback `<svelte:fragment>` md:contents
- **Acceptance**: pull บน iPhone refresh data, desktop scroll ปกติ
- **Size**: M | **Priority**: P2

### TASK-605 — Reduced motion support
- **Files**: `src/app.css`
- **Steps**:
  1. `@media (prefers-reduced-motion: reduce)` ลด animation duration → 0.01s
  2. Apply กับ bottom sheet, toast, transition ทั้งหมด
- **Desktop isolation**: ใช้ทุก viewport — เป็น a11y improvement, ไม่กระทบ visual desktop ปกติ
- **Acceptance**: เปิด reduced motion ใน OS แล้ว animation หาย
- **Size**: S | **Priority**: P1

---

## Phase 7 — Accessibility

### TASK-701 — Focus state + VoiceOver pass
- **Files**: ทั่วทั้ง mobile components
- **Steps**:
  1. ทุก interactive ต้องมี `:focus-visible` ring
  2. Bottom sheet: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  3. Status banner: `aria-live="polite"`, `role="status"`
- **Desktop isolation**: a11y ดีต่อทุก viewport
- **Acceptance**: VoiceOver iOS อ่าน sheet title + ลำดับ focus ถูก
- **Size**: M | **Priority**: P0

### TASK-702 — Dynamic Type / text overflow
- **Files**: KPI cards, button components
- **Steps**:
  1. เพิ่ม unit test render ที่ font-size 200%
  2. แก้ overflow → `text-ellipsis` + tooltip หรือ multi-line
- **Desktop isolation**: ตรวจ desktop ไม่เกิน overflow ด้วย
- **Acceptance**: iOS large text setting ไม่ทำให้ button ล้น
- **Size**: M | **Priority**: P1

---

## Phase 8 — QA & Release

### TASK-801 — iPhone QA matrix execution
- **Steps**: รัน scenario ทั้งหมดจาก plan section "iPhone QA Matrix" บน device จริง
- **Acceptance**: รายงาน pass/fail ครบทุก row
- **Size**: M | **Priority**: P0

### TASK-802 — Android QA matrix execution
- **Devices**: Pixel small/standard/large + Samsung Galaxy small/large
- **Modes**: Chrome tab, installed PWA, offline, low data mode
- **Acceptance**: รายงาน pass/fail
- **Size**: M | **Priority**: P0

### TASK-803 — Playwright mobile coverage
- **Files**: `tests/pwa-mobile.spec.ts`
- **Steps**:
  1. Mobile viewport project (375x812 + 412x915)
  2. Test: install prompt visibility, offline banner copy, draft autosave, sync queue idempotency
- **Desktop isolation**: ใช้ Playwright project แยก mobile ไม่กระทบ desktop spec
- **Acceptance**: CI green
- **Size**: M | **Priority**: P1

### TASK-804 — Desktop regression check
- **Files**: ไม่แก้โค้ด — checklist
- **Steps**:
  1. เปรียบ screenshot desktop (≥1280px) หลัง PR กับ baseline TASK-002
  2. Login → portfolio → trades → journal → analytics → settings ครบ
  3. ตรวจ sidebar, header, modal, table layout เหมือนเดิม
- **Acceptance**: zero visual diff บน desktop pages
- **Size**: M | **Priority**: P0 (gate ก่อน merge ทุก phase)

### TASK-805 — Lighthouse PWA + a11y baseline
- **Steps**: Lighthouse PWA installability pass + Accessibility ≥ 90
- **Acceptance**: รายงานแนบใน PR
- **Size**: S | **Priority**: P0

### TASK-806 — Release notes (TH/EN)
- **Files**: `docs/release-notes/pwa-mobile.md`
- **Steps**: สรุปการเปลี่ยนแปลงสำหรับ user, screenshot install flow
- **Acceptance**: copy ตรวจโดย product owner
- **Size**: S | **Priority**: P1

---

## Cross-cutting Constraints

### Service worker versioning
- ทุก SW change ต้อง bump cache version key
- เพิ่ม update prompt: `มีเวอร์ชันใหม่ - แตะเพื่อรีเฟรช`

### Feature flag
- เพิ่ม env `PUBLIC_PWA_MOBILE_ENABLED=true|false` คุม Phase 4+ rollout ทีละกลุ่มได้

### Analytics events ที่ต้อง log
| Event | Properties |
| --- | --- |
| `pwa.install.shown` | platform, source |
| `pwa.install.dismissed` | platform |
| `pwa.install.accepted` | platform |
| `pwa.standalone.launched` | route |
| `pwa.offline.entered` | route |
| `pwa.draft.saved` | type |
| `pwa.sync.flushed` | count, durationMs |
| `pwa.sync.failed` | endpoint, errorCode |
| `pwa.push.permission.requested` | trigger |
| `pwa.push.permission.granted` | trigger |
| `pwa.push.clicked` | category, url |

### Resolved Open Decisions (ต้องตอบก่อน Phase 4)
- [ ] `start_url` = `/` หรือ `/portfolio`?
- [ ] Manual trade entry queue offline หรือ draft only?
- [ ] Sync Center: bottom sheet, page, หรือทั้งคู่?
- [ ] Notification prompt: onboarding, Settings only, หรือ contextual?
- [ ] Idempotency table: shared หรือ per-feature?

---

## Task Index (สำหรับ tracking)

| Phase | Range | Count | P0 | P1 | P2 |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 Foundation | 001-003 | 3 | 3 | 0 | 0 |
| 1 Install | 101-105 | 5 | 3 | 2 | 0 |
| 2 App Shell | 201-205 | 5 | 3 | 2 | 0 |
| 3 Offline Read | 301-304 | 4 | 2 | 2 | 0 |
| 4 Offline Write | 401-410 | 10 | 5 | 4 | 1 |
| 5 Push & Badge | 501-504 | 4 | 0 | 3 | 1 |
| 6 Forms/Sheets | 601-605 | 5 | 2 | 2 | 1 |
| 7 A11y | 701-702 | 2 | 1 | 1 | 0 |
| 8 QA | 801-806 | 6 | 4 | 2 | 0 |
| **Total** | | **44** | **23** | **18** | **3** |

แนะนำลำดับเริ่ม: TASK-001 → 003 → 101 → 102 → 201 → 202 → 301 → 304 → 601 → 701 (P0 ที่ unlock งานอื่น) จากนั้นค่อยลงลึก Phase 4
