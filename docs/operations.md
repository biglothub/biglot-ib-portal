# Operations

หน้านี้สรุปสิ่งที่ต้องใช้ในการรันระบบ, bridge responsibilities, maintenance และ testing baseline ปัจจุบัน

## 1. Runtime Requirements

| Component | Requirement |
| --- | --- |
| Web app | Node.js 20+, npm |
| Bridge | Python `>=3.10` ตาม `bridge-ib-portal/pyproject.toml` |
| MT5 | MetaTrader 5 terminal ต้องติดตั้งบนเครื่องที่รัน bridge |
| Supabase | web app และ bridge ต้องชี้ project เดียวกัน |

## 2. Environment Variables

### Root app `.env`

| Variable | ใช้โดย | จำเป็นหรือไม่ | หมายเหตุ |
| --- | --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | browser + SSR | ต้องมี | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | browser + SSR | ต้องมี | public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side admin/auth flows | ต้องมี | ใช้กับ service-role client |
| `MT5_ENCRYPTION_KEY` | web API encrypt MT5 password | ต้องมี | 64 hex chars และต้องตรงกับ bridge |
| `OPENAI_API_KEY` | AI chat route | ต้องมีถ้าจะใช้ AI chat | current `.env.example` ยังไม่ได้ใส่ variable นี้ |

### Bridge `.env`

| Variable | ใช้โดย | จำเป็นหรือไม่ | หมายเหตุ |
| --- | --- | --- | --- |
| `SUPABASE_URL` | bridge | ต้องมี | URL ของ project เดียวกับ web app |
| `SUPABASE_KEY` | bridge | ต้องมี | service-role key |
| `MT5_PATH` | bridge | ควรมี | path ไปยัง terminal executable |
| `MT5_ENCRYPTION_KEY` | bridge | ต้องมี | ต้องตรงกับฝั่ง web app |
| `SYNC_INTERVAL` | bridge loop | optional | default `60` seconds |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications | optional | ถ้าไม่ตั้งจะ skip notify |
| `TELEGRAM_ADMIN_CHAT_ID` | Telegram notifications | optional | ใช้แจ้ง admin กลาง |

## 3. Local Startup

### Web app

```bash
npm install
npm run dev
```

useful commands:

```bash
npm run check
npm run build
npm run preview
```

### Bridge

```bash
cd bridge-ib-portal
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

auto-restart wrapper:

```bash
cd bridge-ib-portal
bash start.sh
```

### Database migrations

ใช้ workflow ปกติของทีม เช่น:

```bash
supabase db push
```

## 4. Bridge Responsibilities

bridge loop อยู่ใน `bridge-ib-portal/main.py` และทำงานตามลำดับนี้ในแต่ละรอบ:

1. อ่าน pending accounts ที่ `mt5_validated = false`
2. พยายาม login MT5 เพื่อ validate credentials
3. update `mt5_validated`, `mt5_validation_error`, `last_validated_at`
4. เขียน notifications ให้ admin หรือ IB และ optionally ส่ง Telegram
5. อ่าน approved accounts ทั้งหมด
6. login เข้า MT5 ของแต่ละ account
7. upsert `equity_snapshots` ทุกช่วงเวลา 5 นาที
8. replace `open_positions`
9. ดึง `history_deals_get()` แล้ว upsert `trades`
10. ดึง `copy_rates_range()` เพื่อสร้าง `trade_chart_context`
11. recompute `daily_stats` เฉพาะวันที่โดนแตะและวันปัจจุบัน
12. update `client_accounts.last_synced_at`, `sync_count`, `sync_error`

ถ้า sync account ใดล้มเหลว:

- bridge จะเขียน `sync_error`
- bridge จะไม่หยุดทั้ง loop เว้นแต่มี cycle-level exception ใหญ่

## 5. Maintenance Scripts

| Command | ใช้เมื่อ | ผลลัพธ์ |
| --- | --- | --- |
| `npx tsx scripts/encrypt-existing-passwords.ts` | มี row เก่าที่เก็บ MT5 password แบบ plain text | encrypt values ให้สอดคล้อง flow ปัจจุบัน |
| `cd bridge-ib-portal && python backfill_daily_stats.py` | ต้อง rebuild `daily_stats` จาก `trades` + `equity_snapshots` | เขียน daily rows ใหม่ทั้งระบบ |

## 6. Deployment / Runtime Notes

- current SvelteKit adapter คือ `@sveltejs/adapter-auto`
- admin pages หลายหน้าต้องมี `SUPABASE_SERVICE_ROLE_KEY` เพราะ query ผ่าน service-role client
- rate limiting ปัจจุบันเป็น in-memory `Map` ใน process เดียว ไม่ share state ข้าม instance
- bridge ใช้ fixed `SERVER_OFFSET = 10800`; ถ้า broker/terminal timezone เปลี่ยน ต้อง review time conversion

## 7. Testing Baseline

ผลการตรวจล่าสุดใน environment นี้:

- `npm run check` : ผ่าน (`0 errors`, `0 warnings`)
- `pytest -q` ใน `bridge-ib-portal/` : ยังรันไม่ได้ เพราะ `pytest` ไม่อยู่ใน `PATH`

สิ่งที่ควรทำก่อน deploy หรือ merge:

```bash
npm run check
npm run build
```

ถ้า environment ของ bridge มี `pytest` พร้อมใช้งาน:

```bash
cd bridge-ib-portal
pytest -q
```

## 8. Known Assumptions / Gaps

| เรื่อง | สถานะปัจจุบัน | ผลกระทบ |
| --- | --- | --- |
| Adapter | ใช้ `@sveltejs/adapter-auto` | วิธี deploy จริงขึ้นกับ platform ปลายทาง |
| Bridge folder name | โฟลเดอร์จริงคือ `bridge-ib-portal/` | เอกสารเก่าบางจุดยังอ้าง `bridge/` |
| Trade attachments | เก็บเป็น URL/path ใน DB เท่านั้น | ยังไม่มี object storage upload flow |
| AI env example | `.env.example` ยังไม่ใส่ `OPENAI_API_KEY` | ฟีเจอร์ AI chat จะใช้ไม่ได้ถ้าไม่เพิ่ม env เอง |
| Rate limit storage | อยู่ใน memory ของ process | multi-instance จะไม่ share quota |

## 9. Operational Checklist

- ตรวจว่า web app และ bridge ใช้ `MT5_ENCRYPTION_KEY` เดียวกัน
- ตรวจว่า bridge ใช้ service-role key ของ project เดียวกับ web app
- ตรวจว่า admin notifications และ Realtime เปิดใช้งานแล้ว
- ตรวจว่า MT5 terminal พร้อมใช้งานบน host ที่รัน bridge
- ถ้าเปิด AI chat ให้ตั้ง `OPENAI_API_KEY` ฝั่ง app server

## 10. 2FA Lost Device Runbook

- current web app ใช้ 2FA แบบ TOTP ผ่าน authenticator app เท่านั้น
- ถ้า user เปลี่ยนเครื่องหรือสูญเสียอุปกรณ์และไม่สามารถสร้างรหัสได้ ให้ทีมงานยืนยันตัวตนกับผู้ใช้ตาม process ภายในก่อนทุกครั้ง
- หลังยืนยันตัวตนแล้ว ให้ admin/support ใช้ Supabase dashboard หรือ admin tooling เพื่อลบ MFA factor ของ user คนนั้น
- เมื่อ factor ถูกลบแล้ว user จะ login ได้ด้วย first factor ตามปกติ และต้องกลับไปเปิด 2FA ใหม่จาก `Settings > Security`
- ห้ามขอ secret key หรือรหัส TOTP ปัจจุบันจากผู้ใช้ผ่านช่องทาง support
