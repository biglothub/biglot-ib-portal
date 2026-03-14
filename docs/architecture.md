# Architecture

เอกสารหน้านี้สรุป current implementation ของระบบตามโค้ดใน repo ปัจจุบัน ไม่ใช่ target architecture หรือ proposal สำหรับ refactor ในอนาคต

## 1. System Context

```mermaid
flowchart LR
    subgraph Users
        A[Admin]
        I[Master IB]
        C[Client]
    end

    subgraph Web["SvelteKit Web App"]
        B[Browser UI]
        S[SvelteKit server loads + API routes]
    end

    subgraph Supabase["Supabase Project"]
        AUTH[Auth]
        DB[(Postgres + RLS + RPC)]
        RT[Realtime]
    end

    subgraph Bridge["Python MT5 Bridge"]
        BR[bridge-ib-portal/main.py]
        MT[MetaTrader 5 terminal]
    end

    OAI[OpenAI API]
    TG[Telegram]

    A --> B
    I --> B
    C --> B

    B -->|navigate / form submit| S
    B -->|email-password / Google OAuth| AUTH
    B -->|notifications read/update| DB
    RT -->|notification INSERT events| B

    S -->|SSR auth/session| AUTH
    S -->|queries + RPC| DB
    S -->|AI chat requests| OAI

    BR -->|service-role reads/writes| DB
    BR -->|login / account / deals / rates| MT
    BR -->|validation + sync alerts| TG
```

## 2. Trust Boundaries

- Browser ใช้ `PUBLIC_SUPABASE_ANON_KEY` และ session cookie; จึงเห็นเฉพาะข้อมูลที่ RLS อนุญาต
- SvelteKit server ส่วนใหญ่ใช้ SSR Supabase client (`createSupabaseServerClient`) เพื่อ query ภายใต้ session ของ user
- บาง flow ใช้ service-role โดยตรงผ่าน `createSupabaseServiceClient()` เช่น admin dashboards, Master IB user creation, password reset และ OAuth account linking
- Python bridge ใช้ service-role key ทั้งหมดและ bypass RLS โดยตั้งใจ
- OpenAI API ถูกเรียกจาก server route เท่านั้น; browser ไม่ถือ API key
- Telegram เป็น outbound notification only; ไม่มี inbound control path กลับเข้าระบบ

## 3. Container View

```mermaid
flowchart TB
    subgraph Browser["Browser / Client Runtime"]
        LOGIN[auth/login page]
        UI[role-based pages]
        BELL[NotificationBell]
        CHAT[AiChatPanel]
    end

    subgraph App["SvelteKit Application"]
        HOOK[hooks.server.ts]
        LOADS[SSR load functions]
        API[src/routes/api/**]
        SERVERLIB[src/lib/server/*]
        BROWSERLIB[src/lib/supabase.ts]
    end

    subgraph SB["Supabase"]
        SBAUTH[Auth]
        SBDB[(Postgres tables)]
        SBRPC[DB helper functions + RPC]
        SBRT[Realtime notifications]
    end

    subgraph PY["bridge-ib-portal/"]
        MAIN[main.py]
        CORE[core.py]
        STATS[stats.py]
        BACKFILL[backfill_daily_stats.py]
    end

    EXT1[MetaTrader5]
    EXT2[OpenAI API]
    EXT3[Telegram]

    LOGIN --> BROWSERLIB
    UI --> HOOK
    BELL --> BROWSERLIB
    CHAT --> API

    HOOK --> LOADS
    HOOK --> API
    HOOK --> SBAUTH
    LOADS --> SBDB
    API --> SBDB
    API --> SBRPC
    SERVERLIB --> SBDB
    SERVERLIB --> SBAUTH
    BROWSERLIB --> SBAUTH
    BROWSERLIB --> SBDB
    SBRT --> BELL

    API -->|portfolio AI chat| EXT2

    MAIN --> CORE
    MAIN --> STATS
    BACKFILL --> STATS
    CORE --> SBDB
    MAIN --> SBDB
    MAIN --> EXT1
    CORE --> EXT3
```

## 4. Web Request Flow

### SSR / page load

1. Request เข้า `src/hooks.server.ts`
2. ระบบสร้าง SSR Supabase client จาก cookie
3. โหลด `session`, `user`, `profile`
4. ตรวจ route guard ตาม `profile.role`
5. เรียก `+layout.server.ts` หรือ `+page.server.ts`
6. Page loads query Supabase ผ่าน SSR client หรือ service-role client ตาม route

### Browser-only flow

- login page ใช้ browser Supabase client สำหรับ `signInWithPassword()` และ `signInWithOAuth()`
- `NotificationBell.svelte` query/update `notifications` และ subscribe Realtime โดยตรงจาก browser

## 5. Sequence: Admin Creates Master IB

```mermaid
sequenceDiagram
    participant Admin
    participant API as POST /api/admin/ibs
    participant AuthSvc as createMasterIBUser()
    participant SAuth as Supabase Auth Admin API
    participant Trigger as handle_new_user()
    participant DB as Postgres

    Admin->>API: ส่ง email, full_name, ib_code, company_name
    API->>AuthSvc: validate input + rate limit
    AuthSvc->>SAuth: auth.admin.createUser(...)
    SAuth->>Trigger: insert auth.users row
    Trigger->>DB: create profiles row (role=master_ib)
    AuthSvc->>DB: insert master_ibs row
    DB-->>AuthSvc: success
    AuthSvc-->>API: user id + temp password
    API-->>Admin: JSON success
```

จุดสำคัญ:

- profile ของ Master IB ไม่ได้สร้างจาก app code โดยตรง แต่สร้างผ่าน trigger บน `auth.users`
- ถ้า insert `master_ibs` ไม่สำเร็จ helper จะ rollback ด้วย `auth.admin.deleteUser()`

## 6. Sequence: IB Submit -> Validate -> Approve -> Client Links Google

```mermaid
sequenceDiagram
    participant IB
    participant IBAPI as POST /api/ib/clients
    participant DB as Postgres
    participant Bridge as main.py
    participant MT5 as MetaTrader5
    participant Admin
    participant ApproveRPC as admin_transition_client_account()
    participant Client
    participant OAuth as GET /auth/callback
    participant Service as service-role client

    IB->>IBAPI: submit client_name, client_email, MT5 creds
    IBAPI->>IBAPI: encrypt mt5_investor_password
    IBAPI->>DB: insert client_accounts(status=pending)
    IBAPI->>DB: insert approval_log(action=submitted)

    loop every SYNC_INTERVAL
        Bridge->>DB: read pending accounts where mt5_validated=false
        Bridge->>MT5: login(account id, decrypted password, server)
        alt validation success
            Bridge->>DB: update mt5_validated=true
            Bridge->>DB: notify admins
        else validation failed
            Bridge->>DB: update mt5_validation_error
            Bridge->>DB: notify IB
        end
    end

    Admin->>ApproveRPC: approve pending account
    ApproveRPC->>DB: status=approved + approval_log + notifications
    DB-->>Admin: sanitized account JSON

    Client->>OAuth: Google OAuth callback
    OAuth->>Service: read profile + linked account + approved matching email
    alt approved unlinked account found
        Service->>DB: set client_accounts.user_id = auth user id
        OAuth-->>Client: redirect /
    else no approved matching account
        Service->>Service: delete auth user + sign out
        OAuth-->>Client: redirect /auth/login?error=no_account
    end
```

จุดสำคัญ:

- approved client link ใช้ normalized email
- current implementation เลือก account แรกที่ `approved` และ `user_id IS NULL`
- unauthorized Google signups ถูกลบทิ้งจาก Supabase Auth ทันที

## 7. Sequence: Approved Account Sync Cycle

```mermaid
sequenceDiagram
    participant Loop as bridge main loop
    participant DB as Postgres
    participant MT5 as MetaTrader5
    participant Stats as recompute_daily_stats_for_account()

    loop every SYNC_INTERVAL
        Loop->>DB: select approved client_accounts
        Loop->>MT5: login with decrypted MT5 password
        alt login success
            Loop->>DB: upsert equity_snapshots (5-minute bucket)
            Loop->>DB: replace open_positions
            Loop->>MT5: history_deals_get()
            Loop->>DB: upsert trades by (client_account_id, position_id)
            Loop->>MT5: copy_rates_range() for synced trades
            Loop->>DB: upsert trade_chart_context
            Loop->>Stats: recompute touched UTC dates + current state
            Stats->>DB: upsert daily_stats
            Loop->>DB: update client_accounts.last_synced_at, sync_count, clear sync_error
        else login or sync failure
            Loop->>DB: update client_accounts.sync_error + last_synced_at
        end
    end
```

จุดสำคัญ:

- `daily_stats` ถูกคำนวณแบบ per-day table ไม่ใช่ lifetime summary
- bridge ใช้ `SERVER_OFFSET = 10800` เพื่อแปลง MT5 server time เป็น UTC ใน implementation ปัจจุบัน
- trade chart context เก็บ bars ระดับ `M5` พร้อม padding รอบ trade เปิด/ปิด

## 8. Sequence: Client AI Chat

```mermaid
sequenceDiagram
    participant Client
    participant API as POST /api/portfolio/ai-chat
    participant OpenAI as OpenAI chat.completions
    participant Tools as executeTool()
    participant DB as Postgres

    Client->>API: messages[]
    API->>DB: read approved account + latest daily_stats
    API->>OpenAI: system prompt + user messages + tools
    alt model requests tools
        OpenAI-->>API: tool_calls
        API->>Tools: execute per tool call
        Tools->>DB: read trades / daily_stats / journal / review / playbooks / snapshots
        DB-->>Tools: result JSON
        Tools-->>API: tool output
        API->>OpenAI: continue conversation with tool responses
    end
    OpenAI-->>API: final assistant response
    API-->>Client: streaming text_delta / tool_use / done
```

จุดสำคัญ:

- route จำกัดเฉพาะ `client`
- rate limit ใช้ key `ai-chat:${profile.id}` และ limit 20 requests / 60 seconds
- response เป็น line-delimited JSON stream ไม่ใช่ WebSocket

## 9. Architecture Notes

- `src/hooks.server.ts` คือ choke point หลักของ authentication + authorization ฝั่ง web
- ฝั่ง admin ใช้ service-role มากกว่าส่วนอื่น เพราะต้อง aggregate ข้อมูลทั้งระบบ
- ฝั่ง client portfolio ใช้ RLS หนัก และหลาย query intentionally ไม่ filter `user_id` ซ้ำ เพราะ code อาศัย RLS เป็น ownership boundary
- `NotificationBell.svelte` คือ component เดียวที่ใช้ browser Supabase client query/update data เป็นประจำหลัง login
