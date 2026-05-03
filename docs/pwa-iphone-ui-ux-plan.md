# iPhone PWA UI/UX Plan

วันที่จัดทำ: 3 พฤษภาคม 2026

เอกสารนี้เป็นแผนปรับ IB Portal ให้เป็น PWA ที่รู้สึกเหมือนแอปบน iPhone โดยต่อยอดจาก implementation ปัจจุบันใน repo นี้ ไม่ใช่การเริ่มใหม่ทั้งหมด เป้าหมายหลักคือให้ client เปิดจาก Home Screen ได้เร็ว ใช้งานมือเดียวได้ดี เห็นสถานะ online/offline ชัด และไม่ทำให้ข้อมูลการเทรดสับสนเมื่อ network ไม่เสถียร

## สถานะปัจจุบัน

สิ่งที่มีแล้ว:

- `static/manifest.json` มี `name`, `short_name`, `display: standalone`, theme/background color, icons และ maskable icons
- `src/app.html` มี manifest, iOS meta tags, `apple-touch-icon`, startup images และ `viewport-fit=cover`
- `src/service-worker.ts` precache static assets, offline page, portfolio navigation cache และ push notification handlers
- `src/routes/offline/+page.svelte` มี offline fallback page ภาษาไทย
- `src/lib/components/layout/InstallPrompt.svelte` มี iOS install instruction bottom sheet และ Android install prompt
- `src/lib/components/layout/MobileNav.svelte` มี bottom navigation สำหรับ mobile
- `src/lib/components/shared/NetworkStatus.svelte` มี offline banner และ reconnect toast
- `src/app.css` มี safe-area handling สำหรับ standalone mode

ช่องว่างหลัก:

- iPhone install flow ยังเป็น prompt เดียว ไม่ได้เป็น guided flow ตาม Safari share sheet
- ยังไม่มี explicit "PWA mode" app shell ที่ปรับ spacing, header, bottom nav และ status bar อย่างเป็นระบบ
- Offline ปัจจุบันเน้น cached portfolio pages ยังไม่ชัดว่า data ไหนสด, data ไหน cached และ action ไหนรอ sync
- ยังไม่มี offline write queue สำหรับ draft/action ที่เหมาะสม เช่น journal draft, trade review draft, note draft
- Push notification มี backend/worker แล้ว แต่ UX permission, notification preference และ badge policy ยังไม่แยกสำหรับ iPhone PWA
- ยังไม่มี QA matrix เฉพาะ iPhone, Safari, standalone Home Screen และ iOS edge cases

## Product Goal

ทำให้ IB Portal บน iPhone เป็น "daily trading companion" ที่ client เปิดดูได้เหมือน native app:

- เปิดจาก Home Screen แล้วเข้า `/portfolio` ได้เร็ว
- ดูภาพรวมพอร์ต, trades, journal และ analytics ได้สะดวกในมือเดียว
- ใช้งานได้เมื่อ internet หลุด โดยไม่สับสนว่าสิ่งที่เห็นคือข้อมูลล่าสุดหรือ cached
- บันทึก draft ที่ไม่เสี่ยงได้ขณะ offline แล้ว sync เมื่อกลับมา online
- แจ้งเตือนเฉพาะเรื่องสำคัญ เช่น sync สำเร็จ, alert threshold, risk warning โดยไม่รบกวนเกินจำเป็น

## iPhone Constraints

ข้อจำกัด/พฤติกรรมที่ต้องออกแบบรองรับ:

- iOS Safari ไม่มี `beforeinstallprompt` แบบ Android ดังนั้น install UX ต้องสอนผู้ใช้กด Share แล้วเลือก "Add to Home Screen"
- เมื่อเปิดจาก Home Screen แบบ standalone จะไม่มี Safari toolbar ผู้ใช้ต้องมี navigation, back affordance และ refresh/sync action ใน UI เอง
- ต้องรองรับ safe area ของ notch, Dynamic Island และ home indicator ด้วย `env(safe-area-inset-*)`
- Touch target ควรอย่างน้อย 44 x 44px และ primary actions ควรอยู่ใน thumb zone ช่วงล่างของจอ
- iOS Web Push ใช้ได้กับ Home Screen web apps บน iOS 16.4 ขึ้นไป แต่ต้องขอ permission จาก user gesture และต้องแสดง notification ทันทีเมื่อรับ push
- Safari memory และ background lifecycle จำกัดกว่า desktop จึงต้องหลีกเลี่ยง state ที่หายแล้วทำให้ผู้ใช้เข้าใจผิด

## Design Principles

- **Thumb-first**: action สำคัญอยู่ช่วงล่างหรือเข้าถึงด้วย bottom sheet
- **Status always visible**: online, cached, syncing, pending และ error ต้องเห็นชัด
- **No hidden risk**: action ที่ยังไม่ sync ต้องไม่ดูเหมือนสำเร็จแล้ว
- **Fast first screen**: dashboard ต้องมี skeleton/last cached state และไม่ block ด้วย data รอง
- **Native-feeling, web-safe**: ใช้ iOS-like structure เช่น bottom nav, bottom sheets, pull-to-refresh แต่ยังคง web accessibility
- **Trading context first**: จอแรกควรตอบว่า "พอร์ตตอนนี้เป็นอย่างไร" ไม่ใช่ marketing หรือคำอธิบายแอป

## Target iPhone Experience

### First Visit In Safari

Goal: ทำให้ผู้ใช้เข้าใจว่าติดตั้งเป็นแอปได้ โดยไม่รบกวนเร็วเกินไป

UX:

- แสดง install nudge หลังผู้ใช้ผ่าน login และเห็น portfolio อย่างน้อย 1 ครั้ง
- ใช้ bottom sheet ขนาดกะทัดรัด ไม่บังข้อมูลหลักทั้งจอ
- Copy ควรเป็น action-oriented:
  - Title: `เพิ่ม IB Portal ลงหน้าจอโฮม`
  - Body: `เปิดดูพอร์ตได้เร็วขึ้น และรับการแจ้งเตือนสำคัญจากระบบ`
  - Step chips: `1 กดแชร์`, `2 เพิ่มในหน้าจอโฮม`, `3 เปิดจากไอคอน IB Portal`
- มี secondary action `ไว้ทีหลัง` และ snooze 7 วันตาม pattern ปัจจุบัน
- มี entry point ถาวรใน Settings หรือ More menu: `ติดตั้งแอปบน iPhone`

Implementation:

- ปรับ `InstallPrompt.svelte` ให้แยก state เป็น `eligible`, `snoozed`, `installed`, `unsupported`
- ตรวจ `navigator.standalone` และ `matchMedia('(display-mode: standalone)')`
- แสดง iOS instruction เฉพาะ Safari/iOS ที่ยังไม่ standalone
- เพิ่ม visual step guide ด้วย icon ปุ่ม share และ home screen icon

Acceptance criteria:

- ไม่แสดง install sheet ใน standalone mode
- ไม่แสดงซ้ำภายใน 7 วันหลัง dismiss
- ผู้ใช้เปิด install guide ได้เองจาก More menu หรือ Settings
- Copy ต้องไม่อ้างว่า "ติดตั้งอัตโนมัติ" เพราะ iOS ต้องทำผ่าน Share sheet

### Home Screen Launch

Goal: เปิดจาก Home Screen แล้วรู้สึกเป็นแอป ไม่ใช่เว็บที่ถูกครอบ

UX:

- Start URL ควรพาผู้ใช้ที่ authenticated ไป `/portfolio`
- Header บน portfolio ต้องรองรับ standalone mode โดยไม่ชน status bar
- Loading แรกควรใช้ branded splash ที่สอดคล้องกับ dark theme
- ถ้า session หมดอายุ ให้แสดง login state แบบ mobile-first ไม่ใช่ redirect loop

Implementation:

- ตรวจ `static/manifest.json` ว่า `start_url` เหมาะกับ auth redirect หรือควรใช้ `/?source=pwa`
- ใน root/server load ให้ redirect logged-in client ไป `/portfolio` ตาม role โดยไม่ทำให้ offline fallback แตก
- เพิ่ม `PwaAppShell` หรือ class-level pattern ใน portfolio layout สำหรับ standalone spacing
- ปรับ safe area ของ fixed bottom nav, FAB, toast, install sheet และ offline banner ให้สม่ำเสมอ

Acceptance criteria:

- เปิดจาก Home Screen บน iPhone แล้วไม่เห็น Safari address bar
- Header, offline banner, bottom nav, FAB ไม่ชน notch/home indicator
- Refresh/reconnect ไม่ทำให้ layout กระโดด

### App Navigation

Goal: ใช้มือเดียวได้เร็วและ predictable

UX:

- Bottom nav หลัก 5 จุด:
  - `ภาพรวม`
  - `เทรด`
  - `บันทึก`
  - `รายงาน`
  - `เพิ่มเติม`
- More drawer ใช้ bottom sheet เต็มความกว้าง มี handle, focus trap, close on swipe/down/backdrop
- หน้า detail ต้องมี mobile back affordance ที่ชัด เพราะ standalone ไม่มี browser back UI
- Primary FAB ไม่ควรทับ bottom nav หรือ AI chat button

Implementation:

- เพิ่ม icon consistency ใน `MobileNav.svelte` โดยใช้ icon set เดียวกับระบบ ถ้ามี library อยู่แล้วให้ใช้ library นั้น
- ปรับ `More` drawer ให้แสดงเป็น grouped actions:
  - Tools: Calendar, Replay, AI, Search
  - Account: Settings, Alerts, Guide
  - System: Install app, Sync, Logout
- เพิ่ม route-level mobile header pattern สำหรับ detail pages เช่น trade detail, playbook detail
- จัด z-index stack: offline banner > modal > bottom sheet > toast > FAB > bottom nav

Acceptance criteria:

- ทุก tab แตะได้อย่างน้อย 44px สูง
- Active tab ชัดทั้งสีและ label state
- More drawer ไม่ scroll body ด้านหลัง
- Detail page ย้อนกลับได้ชัดเจนใน standalone mode

### Portfolio Dashboard

Goal: จอแรกตอบสถานะพอร์ตทันที

UX:

- Top summary compact: balance/equity, P&L today, drawdown/risk
- Sync status เป็นส่วนหนึ่งของ header/card แรก ไม่ใช่อยู่ลึก
- ใช้ cards เฉพาะข้อมูลซ้ำหรือ KPI ไม่ใช้ card ซ้อน card
- Chart บน iPhone ควรมี height คงที่และ gesture ไม่ชนกับ scroll
- CTA หลักควรเป็น `Sync ตอนนี้` หรือ `บันทึกเทรด` ตามสถานะ ไม่ต้องมีหลายปุ่มแข่งกัน

Implementation:

- Audit dashboard mobile viewport 375px, 390px, 430px
- จำกัด chart first screen ให้ไม่กินพื้นที่เกินไป
- เพิ่ม last updated text: `อัปเดตล่าสุด 12:45`
- ถ้า offline ให้เปลี่ยน text เป็น `ข้อมูลล่าสุดที่บันทึกไว้ 12:45`

Acceptance criteria:

- iPhone SE ยังเห็นอย่างน้อย portfolio status + one primary action โดยไม่ต้อง scroll เยอะ
- ไม่มี horizontal overflow
- Card title/number ไม่ตัดแบบอ่านไม่รู้เรื่อง

### Offline And Sync UX

Goal: ออฟไลน์แล้วยังใช้งานได้เท่าที่ปลอดภัย และแยก cached/draft/pending ให้ชัด

UX states:

- `Online`: data สด, sync ได้ปกติ
- `Offline cached`: อ่านข้อมูลล่าสุดที่เคยเปิด
- `Offline draft`: ผู้ใช้เขียน journal/note/review draft ได้ แต่ยังไม่ส่ง server
- `Pending sync`: มี action รอส่ง
- `Sync failed`: ส่งไม่สำเร็จและต้องให้ผู้ใช้ retry หรือแก้ข้อมูล

Plan:

- เปลี่ยน offline banner จากข้อความทั่วไปเป็น status ที่ actionable:
  - `ออฟไลน์ - กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด`
  - ปุ่มเล็ก `ดูรายการรอซิงก์` เมื่อมี pending actions
- เพิ่ม `Sync Center` ใน More drawer หรือ Settings:
  - Last successful sync
  - Cached pages/data
  - Pending drafts/actions
  - Retry failed actions
  - Clear local cache
- เพิ่ม badge บน bottom nav/More เมื่อมี pending sync
- สำหรับ action ที่เสี่ยง เช่น delete หรือ admin approval ไม่ควร queue offline ในเฟสแรก

Offline write policy:

| Feature | Offline behavior | Reason |
| --- | --- | --- |
| Portfolio overview | Read cached | ปลอดภัย เป็นข้อมูลอ่านอย่างเดียว |
| Trades list/detail | Read cached | ใช้ดูประวัติได้ |
| Journal draft | Save local draft + sync later | ความเสี่ยงต่ำและผู้ใช้คาดหวังให้พิมพ์ต่อได้ |
| Trade review draft | Save local draft + sync later | เหมาะกับ post-trade workflow |
| Manual trade entry | Optional pending action with clear label | ต้องแสดงชัดว่ายังไม่ sync |
| Delete actions | Online only | ป้องกัน destructive action คลาดเคลื่อน |
| Admin/IB approval | Online only | เป็น workflow สำคัญและต้องใช้ server truth |

Implementation:

- เพิ่ม IndexedDB layer เช่น `src/lib/pwa/offline-db.ts`
- Store แยก:
  - `cached_pages`
  - `portfolio_snapshots`
  - `drafts`
  - `pending_actions`
  - `sync_errors`
- เพิ่ม local draft autosave สำหรับ journal/review
- เพิ่ม mutation queue เฉพาะ allowlist endpoint
- Reconnect แล้ว sync ตามลำดับ, invalidate `portfolio:baseData`, clear pending เมื่อ server ยืนยัน

Acceptance criteria:

- ถ้า offline ผู้ใช้ไม่เข้าใจผิดว่า action ส่งแล้ว
- Draft ไม่หายเมื่อปิดแอปจาก app switcher แล้วเปิดใหม่
- เมื่อกลับ online มี toast `เชื่อมต่อแล้ว - กำลังซิงก์ 2 รายการ`
- ถ้า sync fail ต้องเห็นรายการ retry ได้

### Push Notifications And Badges

Goal: แจ้งเฉพาะข้อมูลที่ควรรู้ทันที และไม่ขอ permission เร็วเกินไป

UX:

- ขอ permission หลังผู้ใช้เห็น value แล้ว เช่น ตั้ง alert หรือเปิด Settings > Notifications
- แยก notification categories:
  - Sync complete/fail
  - Risk threshold
  - Account validation/admin status
  - Journal reminder
  - AI insight ready
- Settings ต้องมี toggle ชัดเจนและคำอธิบายสั้น
- Badge count ใช้เฉพาะ unread notification หรือ pending action ที่สำคัญ

Implementation:

- ปรับ `PushPermission.svelte` ให้เป็น contextual permission ไม่ใช่ global prompt หลัง login
- ใช้ feature detection สำหรับ `PushManager`, `Notification`, `serviceWorker`, `setAppBadge`
- ส่ง visible notification ทุกครั้งที่ service worker รับ push
- Map notification click ไป same-origin URL ผ่าน validator ที่มีอยู่ใน service worker

Acceptance criteria:

- ไม่ขอ notification permission ทันทีหลัง login
- ถ้าผู้ใช้ปฏิเสธ ต้องไม่ prompt ซ้ำแบบรบกวน
- Notification tap เปิด route ที่ถูกต้องใน standalone app/window เดิมถ้ามี
- Badge clear เมื่อผู้ใช้เปิด notification center หรืออ่านข้อความแล้ว

### Forms And Bottom Sheets

Goal: กรอกข้อมูลบน iPhone ได้โดยไม่ zoom, ไม่โดน keyboard บัง และไม่เสีย draft

UX:

- Input font size อย่างน้อย 16px เพื่อป้องกัน iOS auto zoom
- Date/time ใช้ native-friendly input และมี quick presets ถ้าจำเป็น
- Bottom sheet ต้องเลื่อนตาม keyboard และมี safe-area padding
- Long form แตกเป็น sections: Required, Advanced, Notes
- Auto-save draft สำหรับ journal/review

Implementation:

- Audit `QuickTradeEntry.svelte`, journal form, review form
- เพิ่ม keyboard-aware bottom sheet utility ถ้ายังไม่มี
- ปรับ validation error ให้อยู่ใต้ field และไม่ถูก keyboard บัง

Acceptance criteria:

- Focus input แล้ว viewport ไม่ซูม
- Keyboard ไม่บังปุ่ม submit หลัก
- ปิด sheet โดยไม่ตั้งใจต้องถามเมื่อมี unsaved changes

### Gestures And Microinteractions

Goal: ใช้ gesture เพื่อเร็วขึ้น แต่ไม่บังคับให้ผู้ใช้ต้องรู้ gesture

UX:

- Pull-to-refresh ที่ top ของ portfolio pages
- Swipe trade card สำหรับ quick review/tag แต่ต้องมี visible fallback button
- Swipe down close bottom sheet
- Toast สั้นและอยู่เหนือ bottom nav/home indicator

Implementation:

- ตรวจ gesture conflict กับ chart pan/zoom และ page scroll
- เพิ่ม reduced-motion support สำหรับ animations
- ใช้ haptic-like visual feedback เช่น press scale 0.98, highlight, progress indicator

Acceptance criteria:

- Gesture ไม่ทำให้ scroll ติดหรือ accidental action
- ทุก gesture action มีปุ่มสำรองที่มองเห็นได้
- `prefers-reduced-motion` ลด animation สำคัญ

### Accessibility

Goal: ใช้ได้กับ Dynamic Type, VoiceOver และมือเดียว

Checklist:

- Touch target 44 x 44px minimum
- Visible focus state สำหรับ keyboard/external keyboard
- `aria-live` สำหรับ online/offline/sync status
- Bottom sheet มี `role=dialog`, `aria-modal`, focus trap และ Escape/backdrop close
- สีสถานะไม่พึ่งสีอย่างเดียว ต้องมี text/icon
- Dynamic Type: text ต้องไม่ล้น card หรือปุ่มเมื่อ user เพิ่ม font size
- Thai copy ต้องกระชับ ไม่ทำให้ปุ่มยาวเกิน container

## Implementation Roadmap

### Phase 0 - Baseline Audit

Deliverables:

- Capture screenshots บน viewport 320, 375, 390, 430, 440px
- Test Safari browser mode และ Home Screen standalone mode บน iPhone จริง
- Run Lighthouse PWA + Accessibility
- Create issue list แยก severity

Files to inspect:

- `src/app.html`
- `static/manifest.json`
- `src/app.css`
- `src/service-worker.ts`
- `src/routes/portfolio/+layout.svelte`
- `src/lib/components/layout/MobileNav.svelte`
- `src/lib/components/layout/InstallPrompt.svelte`
- `src/lib/components/shared/NetworkStatus.svelte`

Exit criteria:

- มี screenshot baseline
- มีรายการ overflow/z-index/safe-area bugs
- มี Lighthouse PWA baseline score

### Phase 1 - iPhone Install And Launch UX

Deliverables:

- Revamp iOS install guide bottom sheet
- Add manual install guide entry in More/Settings
- Verify splash images and icons
- Optional: update `start_url` strategy for logged-in users

Primary files:

- `src/lib/components/layout/InstallPrompt.svelte`
- `src/lib/components/layout/MobileNav.svelte`
- `src/app.html`
- `static/manifest.json`

Exit criteria:

- Install prompt behavior ถูกต้องใน Safari/iOS
- Standalone detection ถูกต้อง
- User can find install guide after dismiss

### Phase 2 - Standalone App Shell

Deliverables:

- Standardize safe-area classes
- Adjust fixed header/offline banner/toast/bottom nav/FAB offsets
- Add detail-page mobile back affordance
- Define z-index map

Primary files:

- `src/app.css`
- `src/routes/portfolio/+layout.svelte`
- `src/lib/components/layout/MobileNav.svelte`
- detail routes under `src/routes/portfolio/**`

Exit criteria:

- No overlap with notch/home indicator
- No horizontal overflow on iPhone SE through Pro Max sizes
- Detail pages usable without Safari toolbar

### Phase 3 - Offline Read UX

Deliverables:

- Improve offline banner copy and cached timestamp
- Add cached data indicator to portfolio/dashboard/cards
- Add Sync Center read-only view
- Improve `/offline` page with last cached route and retry behavior

Primary files:

- `src/service-worker.ts`
- `src/lib/components/shared/NetworkStatus.svelte`
- `src/routes/offline/+page.svelte`
- `src/routes/portfolio/+layout.svelte`

Exit criteria:

- Offline users know what data is cached
- Retry/reconnect flow is visible and predictable
- No API/auth/Supabase requests cached accidentally

### Phase 4 - Offline Drafts And Pending Sync

Deliverables:

- IndexedDB offline store
- Draft autosave for journal/review
- Pending action queue for allowlisted non-destructive actions
- Sync Center with retry/clear controls
- Badge indicator for pending sync

Primary files:

- `src/lib/pwa/offline-db.ts`
- `src/lib/pwa/sync-queue.ts`
- journal/review components
- `src/lib/components/pwa/SyncCenter.svelte`

Exit criteria:

- Draft survives app close/reopen
- Pending sync visible and retryable
- Destructive/admin actions remain online-only

### Phase 5 - Push And Badging UX

Deliverables:

- Contextual notification permission flow
- Notification preferences grouped by category
- Badge count policy
- Notification click routing QA

Primary files:

- `src/lib/components/layout/PushPermission.svelte`
- `src/service-worker.ts`
- `src/routes/settings/**`
- `src/lib/server/push.ts`

Exit criteria:

- Permission requested only after user gesture
- Notifications route to correct screen
- Badge clears predictably

### Phase 6 - QA And Release

Deliverables:

- iPhone QA checklist
- Playwright mobile coverage for install/offline-visible UI where possible
- Manual device QA results
- Release notes for users

Exit criteria:

- Lighthouse PWA installability pass
- Accessibility score >= 90
- No console errors during first launch, offline, reconnect, push click
- Manual iPhone Safari + standalone checks pass

## iPhone QA Matrix

Devices/viewports:

| Device class | Viewport target | Must test |
| --- | ---: | --- |
| Small iPhone | 320-375px width | iPhone SE style cramped layouts |
| Standard iPhone | 390-393px width | Main target for current iPhones |
| Large iPhone | 428-440px width | Pro Max spacing, Dynamic Island safe area |
| Landscape | 667-956px width | Charts, bottom sheets, keyboard cases |

Browsers/modes:

| Mode | Checks |
| --- | --- |
| Safari tab | install guide, login, portfolio, push permission entry |
| Home Screen standalone | safe area, splash, no Safari UI, back affordance |
| Offline in Safari | cached fallback and offline page |
| Offline standalone | cached portfolio, draft survival, reconnect sync |
| Low Power Mode | animations, background sync expectations |

Scenarios:

- Fresh install: login, see portfolio, install guide appears after delay
- Dismiss install: prompt does not return within snooze window
- Home Screen launch: authenticated user lands on portfolio
- Offline read: open portfolio, turn off network, reopen app
- Offline draft: create journal/review draft offline, close app, reopen
- Reconnect: pending sync submits and status clears
- Push opt-in: enable from Settings, receive notification, tap notification
- Session expired: standalone app shows login without broken shell

## Measurement

Product metrics:

- Install guide view to Home Screen launch rate
- Home Screen launches per active client
- Dashboard first meaningful render time on iPhone
- Offline session count and successful reconnect sync rate
- Push permission opt-in rate
- Notification tap-through rate

Quality metrics:

- Lighthouse PWA installability pass
- Lighthouse Accessibility >= 90
- No horizontal overflow at target widths
- No unhandled sync failures
- No repeated permission prompts after deny/dismiss

## Task Breakdown

| ID | Task | Size | Priority |
| --- | --- | --- | --- |
| PWA-IOS-001 | Audit iPhone Safari + standalone current UX | M | P0 |
| PWA-IOS-002 | Redesign iOS install guide and persistent guide entry | M | P0 |
| PWA-IOS-003 | Standardize standalone safe-area app shell | M | P0 |
| PWA-IOS-004 | Add mobile back affordance for standalone detail pages | S | P1 |
| PWA-IOS-005 | Improve offline banner with cached timestamp and pending status | M | P0 |
| PWA-IOS-006 | Build Sync Center bottom sheet/page | M | P1 |
| PWA-IOS-007 | Add IndexedDB draft store for journal/review | L | P1 |
| PWA-IOS-008 | Add allowlisted pending sync queue | L | P1 |
| PWA-IOS-009 | Make notification permission contextual | M | P1 |
| PWA-IOS-010 | Define and implement app badge policy | S | P2 |
| PWA-IOS-011 | Add iPhone Playwright/mobile tests where automatable | M | P1 |
| PWA-IOS-012 | Manual QA on real iPhone devices | M | P0 |

## Open Decisions

- Should `start_url` remain `/` or become `/portfolio` with server-side role fallback?
- Which actions are safe enough for offline queue in the first release?
- Should Sync Center be a bottom sheet, full page under Settings, or both?
- Do we want notification prompt in onboarding, Settings only, or contextual feature prompts?
- Should quick trade manual entry be allowed offline or only saved as a local draft?

## References

- Apple Safari Web Content Guide: Configuring Web Applications - `apple-touch-icon`, launch screens, standalone mode, status bar behavior: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- Apple Developer Documentation: Sending web push notifications in web apps and browsers - Home Screen web apps on iOS 16.4+, permission gesture, service worker handling, visible notification requirement, badging: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Apple Developer Documentation: BEWebAppManifest - manifest handling for Add to Home Screen flows in browser engines: https://developer.apple.com/documentation/browserenginekit/bewebappmanifest
