# IB Portal Engineering Docs

ชุดเอกสารนี้อธิบายสถาปัตยกรรมและพฤติกรรมของระบบตามโค้ดจริงใน repo นี้ ณ วันที่ 14 มีนาคม 2026 โดยเน้น current-state implementation ไม่ใช่ target architecture ในอนาคต

เอกสารชุดนี้ครอบคลุม SvelteKit web app, Supabase Auth/Postgres/RLS/RPC, Python MT5 bridge, portfolio analytics, journal/review workflow และ AI chat

## ภาพรวมระบบ

IB Portal เป็น portal สำหรับ 3 persona หลัก:

- `admin` จัดการ Master IB, อนุมัติหรือเปลี่ยนสถานะลูกค้า, ดูภาพรวมระบบ
- `master_ib` ส่งบัญชีลูกค้า MT5 เข้าตรวจ, แก้ไขหรือ resubmit บัญชี, ติดตามสถานะ sync
- `client` ล็อกอินด้วย Google หลังถูก approve แล้ว เพื่อดูพอร์ต, journal, review trades, playbooks, progress และ AI chat

ระบบแบ่งออกเป็น 4 runtime component หลัก:

| Component | เทคโนโลยี | หน้าที่ |
| --- | --- | --- |
| Web app | SvelteKit 2 + Svelte 5 + TypeScript | UI, SSR page loads, API routes, route guards |
| Auth/Data | Supabase Auth + Postgres + RLS + RPC | authentication, authorization, persistence, workflow logic |
| Market sync | Python (`bridge-ib-portal/`) + MetaTrader5 | validate MT5 credentials, sync positions/trades/equity, rebuild daily stats |
| AI analysis | OpenAI API ผ่าน `src/routes/api/portfolio/ai-chat/+server.ts` | tool-calling เพื่ออ่านข้อมูลพอร์ตและตอบภาษาไทย |

## Stack ที่ใช้

| Layer | รายละเอียด |
| --- | --- |
| Frontend | SvelteKit, Svelte, Tailwind CSS, `lightweight-charts` |
| Browser Supabase | `@supabase/ssr`, `@supabase/supabase-js` |
| Server helpers | `src/lib/server/*` |
| Database schema | `supabase/migrations/*.sql` |
| Bridge | Python, `MetaTrader5`, `supabase`, `cryptography`, `python-dotenv` |
| Notifications | Supabase Realtime + Telegram |
| AI | `openai` SDK, current model `gpt-4o-mini` |

## Runtime Components

### 1. SvelteKit web app

- `src/hooks.server.ts` สร้าง Supabase SSR client, โหลด session/profile และ enforce role-based routing
- `src/routes/admin/**`, `src/routes/ib/**`, `src/routes/portfolio/**` คือ route group หลัก
- `src/routes/api/**` คือ server endpoints สำหรับ mutation และ portfolio data APIs
- `src/lib/server/supabase.ts` มีทั้ง SSR client และ service-role client

### 2. Supabase project

- Supabase Auth เก็บ identity และ trigger `handle_new_user()` สร้าง `profiles`
- Postgres เก็บ domain data ทั้ง onboarding, workflow, market sync, journal/review
- RLS จำกัดข้อมูลตาม role และ ownership
- RPC/DB functions จัดการ workflow สำคัญแบบ atomic เช่น approve/resubmit/edit/delete
- Realtime publish ตาราง `notifications` ให้ browser bell อัปเดตทันที

### 3. MT5 bridge

- `bridge-ib-portal/main.py` เป็น loop หลัก
- `bridge-ib-portal/core.py` จัดการ Supabase service-role client, MT5 init และ Telegram
- `bridge-ib-portal/stats.py` คำนวณ `daily_stats`
- `bridge-ib-portal/backfill_daily_stats.py` ใช้ rebuild ข้อมูลย้อนหลังแบบ one-time

### 4. External integrations

- MetaTrader 5 terminal ใช้ validate และดึง market/account data
- Telegram ใช้แจ้ง admin และ IB เมื่อ validation success/fail
- OpenAI API ใช้ใน client AI chat โดย route ฝั่ง server เป็นคนเรียก API และ tools

## Repo Map

| Path | ความหมาย |
| --- | --- |
| `src/` | SvelteKit app ทั้ง routes, components, lib |
| `src/routes/api/` | HTTP API surface ของระบบ |
| `src/lib/server/` | server-side helper modules |
| `supabase/migrations/` | schema, constraints, RLS, helper functions, RPC |
| `bridge-ib-portal/` | Python bridge และ tests |
| `scripts/` | one-off maintenance scripts |
| `static/guide.html` | user-facing guide แยกจาก engineering docs |

## Persona Map

| Persona | Login | Root route | ข้อมูลหลักที่เข้าถึง |
| --- | --- | --- | --- |
| `admin` | email/password | `/admin` | ทุก IB, ทุก client, approval workflow, AUM, activity log |
| `master_ib` | email/password | `/ib` | client ของตัวเอง, validation/sync status, recent stats |
| `client` | Google OAuth หลัง approve | `/portfolio` | approved account ของตัวเอง, trades, journal, playbooks, progress, notifications, AI chat |

## อ่านเอกสารชุดนี้อย่างไร

- เริ่มจาก [Architecture](./architecture.md) ถ้าต้องการเห็นภาพรวมระบบและ sequence หลัก
- อ่าน [Data Model](./data-model.md) ถ้าต้องการเข้าใจ schema, ownership, RLS และ RPC
- อ่าน [Features and APIs](./features-and-apis.md) ถ้าต้องการดู route map, endpoint matrix และ auth flow
- อ่าน [Operations](./operations.md) ถ้าต้องการ setup, env vars, bridge loop, maintenance และ testing baseline
- ถ้าต้องการคู่มือสำหรับผู้ใช้งานระบบ ให้ดู [static/guide.html](../static/guide.html)

## Glossary

- `Master IB` ผู้แนะนำลูกค้าเข้าสู่ระบบและดูแลการส่งบัญชี MT5 เข้าตรวจ
- `client account` แถวใน `client_accounts` ที่แทนบัญชี MT5 ของลูกค้าหนึ่งราย
- `approval workflow` ลำดับสถานะ `pending -> approved/rejected -> suspended/reactivated` รวมถึง `resubmitted`
- `sync` งานของ bridge ที่ดึงข้อมูลจาก MT5 แล้ว upsert เข้า Supabase
- `journal` daily reflection/pre-post market notes ของ client ใน `daily_journal`
- `playbook` ชุดกฎ setup/entry/exit/risk สำหรับใช้รีวิวคุณภาพการเทรด
- `review` structured post-trade analysis ใน `trade_reviews`
- `saved view` filter preset ของหน้ารายงาน/analytics ใน `portfolio_saved_views`
- `progress goal` target metric เช่น review completion, journal streak หรือ profit factor

## ข้อสังเกตสำคัญ

- ระบบ client ปัจจุบันถูกออกแบบให้มองเห็น approved account เดียวต่อ user ผ่าน RLS และ unique linking rules
- บาง admin page และ auth setup flow ใช้ service-role client โดยตรง ไม่ได้พึ่ง RLS เพียงอย่างเดียว
- Bridge ใช้ service-role key เต็มสิทธิ์และถือเป็น trusted backend
