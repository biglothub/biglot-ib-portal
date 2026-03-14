# Features and APIs

หน้านี้สรุป route map, auth flow และ API surface ของระบบตาม implementation ปัจจุบัน

## 1. Common Routing Rules

`src/hooks.server.ts` เป็นจุดกลางของการบังคับ routing:

- สร้าง `locals.supabase`, `locals.session`, `locals.user`, `locals.profile`
- อนุญาต public routes:
  - `/auth/login`
  - `/auth/forgot-password`
  - `/auth/callback`
- ถ้าไม่มี session จะ redirect ไป `/auth/login`
- ถ้า role ไม่ตรง route prefix จะ redirect ไปหน้าที่เหมาะสม
- path `/` จะ redirect ตาม role:
  - `admin -> /admin`
  - `master_ib -> /ib`
  - `client -> /portfolio`

หมายเหตุ current-state:

- route guard อนุญาต `/auth/forgot-password` แต่ใน repo นี้ยังไม่มี page/endpoint สำหรับ route นี้

## 2. Route Map by Persona

### Admin

| Route | หน้าที่ | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `/admin` | dashboard ภาพรวมระบบ | `client_accounts`, `master_ibs`, `approval_log`, `daily_stats` |
| `/admin/approvals` | review queue และเปลี่ยนสถานะลูกค้า | `client_accounts`, `master_ibs`, `profiles`, RPC approve/reject/suspend/reactivate |
| `/admin/ibs` | รายการ Master IB ทั้งหมด | `master_ibs`, `profiles`, `client_accounts` |
| `/admin/ibs/[id]` | รายละเอียด IB และลูกค้าทั้งหมดของ IB นั้น | `master_ibs`, `client_accounts` |
| `/admin/clients/[id]` | ดู client account, stats, positions, recent trades | `client_accounts`, `daily_stats`, `open_positions`, `trades` |

### Master IB

| Route | หน้าที่ | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `/ib` | dashboard client summary และ KPI | `client_accounts`, `daily_stats` |
| `/ib/clients` | รายการลูกค้าทั้งหมดของ IB | `client_accounts`, `daily_stats` |
| `/ib/clients/add` | form เพิ่มลูกค้าใหม่ | `POST /api/ib/clients` |
| `/ib/clients/[id]` | รายละเอียด client, history, equity, positions, trades | `client_accounts`, `daily_stats`, `equity_snapshots`, `open_positions`, `trades` |

### Client

| Route | หน้าที่ | แหล่งข้อมูลหลัก |
| --- | --- | --- |
| `/portfolio` | command center / overview | `daily_stats`, `equity_snapshots`, `open_positions`, `trades`, `daily_journal`, `playbooks` |
| `/portfolio/trades` | trade explorer + filters + saved views | `trades`, `trade_tags`, `trade_reviews`, `trade_notes`, `trade_attachments`, `portfolio_saved_views` |
| `/portfolio/trades/[id]` | trade detail, chart context, related trades, same-day journal | `trades`, `trade_chart_context`, `daily_journal`, `playbooks` |
| `/portfolio/journal` | calendar + day journal editor | `daily_journal`, filtered trades |
| `/portfolio/analytics` | filtered analytics/report explorer | `daily_stats`, `trades`, `daily_journal`, `progress_goals`, `portfolio_saved_views` |
| `/portfolio/playbook` | playbook management + setup performance | `playbooks`, `trade_tags`, `trades` |
| `/portfolio/progress` | goals + snapshot progress | `progress_goals`, `trades`, `daily_journal`, `daily_stats` |

shared client layout (`src/routes/portfolio/+layout.server.ts`) preload:

- approved `client_accounts` row ของ user
- `trade_tags`
- `playbooks`
- `portfolio_saved_views`

## 3. API Matrix

### Admin APIs

| Endpoint | Method | Role | Input หลัก | Side effects | Tables / RPC |
| --- | --- | --- | --- | --- | --- |
| `/api/admin/ibs` | `POST` | `admin` | `email`, `full_name`, `ib_code`, `company_name?` | create auth user + profile + master IB record, คืน temp password | `createMasterIBUser()`, Supabase Auth Admin API, `master_ibs` |
| `/api/admin/reset-password` | `POST` | `admin` | `user_id` | reset password ของ Master IB, คืน temp password ใหม่ | service-role `auth.admin.updateUserById()` |
| `/api/admin/approve` | `POST` | `admin` | `client_account_id`, `action`, `reason?` | transition status, write log, send notifications | RPC `admin_transition_client_account(...)` |
| `/api/admin/clients/edit` | `POST` | `admin` | client fields + optional `mt5_investor_password` | encrypt password ใหม่ถ้ามี, update client account, audit log | `encrypt()`, RPC `admin_edit_client_account(...)` |
| `/api/admin/clients/delete` | `POST` | `admin` | `client_account_id`, `reason?` | audit log แล้ว delete client account cascade | RPC `admin_delete_client_account(...)` |

### Master IB APIs

| Endpoint | Method | Role | Input หลัก | Side effects | Tables / RPC |
| --- | --- | --- | --- | --- | --- |
| `/api/ib/clients` | `POST` | `master_ib`, `admin` | client identity + MT5 creds | validate payload, enforce quota, encrypt password, insert pending account + `approval_log(submitted)` | `client_accounts`, `approval_log`, `master_ibs` |
| `/api/ib/clients/edit` | `POST` | `master_ib`, `admin` | `client_account_id`, client basic info | update client basic info เท่านั้น | RPC `ib_edit_client_account(...)` |
| `/api/ib/clients/resubmit` | `POST` | `master_ib`, `admin` | `client_account_id`, MT5 creds | encrypt password, reset validation state, move `rejected -> pending`, notify admins | RPC `ib_resubmit_client_account(...)` |
| `/api/ib/clients/cancel` | `POST` | `master_ib`, `admin` | `client_account_id` | log แล้ว delete pending/rejected account | RPC `ib_cancel_client_account(...)` |

### Client Portfolio APIs

| Endpoint | Method | Role | Input หลัก | Side effects | Tables / RPC |
| --- | --- | --- | --- | --- | --- |
| `/api/portfolio/reports` | `GET` | `client` | query filters | build analytics/report payload ตาม filters | `trades`, `daily_stats`, `daily_journal` |
| `/api/portfolio/progress` | `GET` | `client` | none | build progress snapshot from base data | `progress_goals`, `trades`, `daily_stats`, `daily_journal` |
| `/api/portfolio/progress` | `POST` | `client` | `goal_type`, `target_value`, `period_days`, `is_active` | upsert goal ต่อประเภท | `progress_goals` |
| `/api/portfolio/journal` | `POST` | `client` | journal payload ต่อวัน | upsert `daily_journal` | `daily_journal` |
| `/api/portfolio/playbooks` | `GET` | `client` | none | list playbooks ของ user/account | `playbooks`, `trade_tags` |
| `/api/portfolio/playbooks` | `POST` | `client` | playbook payload, optional `id` | create/update playbook | `playbooks` |
| `/api/portfolio/playbooks` | `DELETE` | `client` | `id` | delete playbook | `playbooks` |
| `/api/portfolio/saved-views` | `GET` | `client` | optional `page` | list saved views | `portfolio_saved_views` |
| `/api/portfolio/saved-views` | `POST` | `client` | `page`, `name`, `filters`, optional `id` | create/update saved view | `portfolio_saved_views` |
| `/api/portfolio/saved-views` | `DELETE` | `client` | `id` | delete saved view | `portfolio_saved_views` |
| `/api/portfolio/tags` | `POST` | `client` | `name`, `category`, `color?` | create trade tag | `trade_tags` |
| `/api/portfolio/tags` | `DELETE` | `client` | `id` | delete trade tag | `trade_tags` |
| `/api/portfolio/trades/[id]/tags` | `POST` | `client` | `tag_id` | assign tag ให้ trade | `trade_tag_assignments` |
| `/api/portfolio/trades/[id]/tags` | `DELETE` | `client` | `tag_id` | unassign tag จาก trade | `trade_tag_assignments` |
| `/api/portfolio/trades/[id]/notes` | `POST` | `client` | `content`, `rating?` | upsert note เดียวต่อ trade | `trade_notes` |
| `/api/portfolio/trades/[id]/review` | `POST` | `client` | review payload | upsert structured review และ set `reviewed_at` เมื่อ status=`reviewed` | `trade_reviews` |
| `/api/portfolio/trades/[id]/attachments` | `GET` | `client` | none | list attachments ของ trade | `trade_attachments` |
| `/api/portfolio/trades/[id]/attachments` | `POST` | `client` | `storage_path`, `kind?`, `caption?`, `sort_order?`, optional `id` | create/update attachment row | `trade_attachments` |
| `/api/portfolio/trades/[id]/attachments` | `DELETE` | `client` | `id` | delete attachment row | `trade_attachments` |
| `/api/portfolio/ai-chat` | `POST` | `client` | `messages[]` | stream assistant response, invoke tools, query portfolio context | OpenAI API, `executeTool()`, `trades`, `daily_stats`, `open_positions`, `daily_journal`, `trade_reviews`, `playbooks`, `equity_snapshots` |

## 4. Auth Flow Summary

### Login page

`src/routes/auth/login/+page.svelte` แบ่ง login สองเส้นทาง:

- `client` ใช้ `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `admin` และ `master_ib` ใช้ `supabase.auth.signInWithPassword()`

### OAuth callback

`src/routes/auth/callback/+server.ts` ทำงานดังนี้:

1. ถ้ามี `code` ให้ `exchangeCodeForSession()`
2. อ่าน authenticated user จาก SSR Supabase client
3. ใช้ service-role client query `profiles`
4. ถ้า role เป็น `admin` หรือ `master_ib` ให้ redirect กลับ root ปกติ
5. ถ้าเป็น client:
   - ถ้ามี linked account อยู่แล้ว ให้ redirect กลับ root
   - ถ้าไม่มี ให้หา approved account ที่ normalized email ตรงกันและ `user_id IS NULL`
   - ถ้าพบ ให้ update `client_accounts.user_id`
   - ถ้าไม่พบ ให้ลบ auth user และ sign out ทันที

### Logout

- `POST /auth/logout` เรียก `locals.supabase.auth.signOut()` แล้ว redirect ไป `/auth/login`

## 5. Notification Behavior

### Sources ของ notifications

- bridge เขียน `notifications` เมื่อ MT5 validation success/fail
- `admin_transition_client_account(...)` เขียน notifications ให้ admin หรือ IB ตอน approve/reject/suspend/reactivate
- client-side ไม่สร้าง notification ใหม่ แต่ mark read หรือ mark all read ได้

### Delivery model

- migration `003_enable_notification_realtime.sql` add table `notifications` เข้า publication `supabase_realtime`
- `NotificationBell.svelte`:
  - query unread/recent notifications จาก browser Supabase client
  - subscribe `postgres_changes` event `INSERT` filter ตาม `user_id`
  - update `is_read` จาก browser ได้โดยตรงภายใต้ RLS

## 6. AI Chat

### Endpoint behavior

- route: `POST /api/portfolio/ai-chat`
- role: `client` เท่านั้น
- rate limit: 20 requests / 60 seconds ต่อ `profile.id`
- request guard:
  - `messages` ต้องเป็น array และไม่ว่าง
  - จำนวน message ไม่เกิน 50
  - content แต่ละข้อความยาวเกิน 2000 chars จะถูก truncate

### Current model and response format

- model ปัจจุบัน: `gpt-4o-mini`
- response format: newline-delimited JSON stream โดยมี event เช่น:
  - `text_delta`
  - `tool_use`
  - `done`
  - `error`

### Tools ที่เปิดให้ model ใช้

- `get_trade_history`
- `get_daily_stats`
- `get_open_positions`
- `get_analytics`
- `get_journal_entries`
- `get_review_context`
- `get_playbooks`
- `get_equity_snapshots`

### Data sources ที่ AI อ่านได้

- `client_accounts` approved account ของ user ปัจจุบัน
- `daily_stats`
- `trades`
- `open_positions`
- `daily_journal`
- `trade_reviews`
- `trade_notes`
- `trade_attachments`
- `playbooks`
- `equity_snapshots`

ข้อจำกัดสำคัญ:

- AI chat ไม่ได้ mutate portfolio data
- system prompt บังคับให้ตอบภาษาไทยและใช้ tools ก่อนตอบคำถามเชิง trading
- current implementation ไม่มี conversation persistence ใน database

## 7. Implementation Notes for Maintainers

- mutation endpoints หลายตัวใช้ in-memory `rateLimit()` ซึ่งเหมาะกับ single-process runtime มากกว่า multi-instance deployment
- admin page loads หลายหน้า intentionally ใช้ service-role client แทน SSR session client
- client portfolio pages หลายจุด rely on RLS เพื่อบังคับ ownership มากกว่าการ filter `user_id` ในโค้ดทุก query
