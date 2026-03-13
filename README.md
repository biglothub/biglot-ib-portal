# IB Portal

SvelteKit + Supabase portal for managing Master IB workflows, client account approval, MT5 syncing, and client-side trading analytics.

## What It Does

- `Admin`
  - Create Master IB users
  - Review and transition client accounts through `pending`, `approved`, `rejected`, `suspended`
  - Monitor IBs and client portfolios
- `Master IB`
  - Submit client MT5 accounts for review
  - Resubmit rejected accounts
  - Track client sync status and portfolio data
- `Client`
  - Sign in with Google after approval
  - View portfolio metrics, equity chart, score breakdown, trading calendar, and analytics dashboard

## Stack

- Frontend/app: SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS
- Auth/data: Supabase Auth + Postgres + RLS
- Market sync: Python bridge using MetaTrader 5
- Charts: `lightweight-charts`

## Repo Layout

```text
src/                   SvelteKit app
supabase/migrations/   Database schema and policy changes
bridge/                MT5 sync service + backfill utilities
scripts/               One-time maintenance scripts
static/guide.html      End-user guide
```

## Key Behaviors

- Role-based routing is enforced in [`src/hooks.server.ts`](/Users/iphone/Desktop/📁 Projects/TSP/ib-portal/src/hooks.server.ts).
- Client Google login is locked to `one Google user = one client account`.
- Browser-facing responses no longer expose `mt5_investor_password`.
- Client account workflow mutations are handled through DB functions for atomicity:
  - `admin_transition_client_account(...)`
  - `ib_resubmit_client_account(...)`
- `daily_stats` is now treated as a true per-day table, not a lifetime summary.

## Requirements

### Web App

- Node.js 20+
- npm

### Bridge

- Python 3.11+
- MetaTrader 5 terminal installed on the host machine
- Access to the same Supabase project used by the web app

## Environment Variables

### Root `.env`

Copy [`.env.example`](/Users/iphone/Desktop/📁 Projects/TSP/ib-portal/.env.example):

```bash
cp .env.example .env
```

Required values:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MT5_ENCRYPTION_KEY`

`MT5_ENCRYPTION_KEY` must be 64 hex chars:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Bridge `.env`

Copy [`bridge/.env.example`](/Users/iphone/Desktop/📁 Projects/TSP/ib-portal/bridge/.env.example):

```bash
cp bridge/.env.example bridge/.env
```

Required bridge values:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `MT5_PATH`
- `MT5_ENCRYPTION_KEY`

Optional:

- `SYNC_INTERVAL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`

Use the same encryption key in both `.env` files.

## Setup

### 1. Install app dependencies

```bash
npm install
```

### 2. Install bridge dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r bridge/requirements.txt
```

### 3. Apply Supabase migrations

Important migrations in current repo state:

- `001_full_schema.sql`
- `002_fix_notification_rls.sql`
- `003_enable_notification_realtime.sql`
- `003_client_google_auth.sql`
- `004_allow_ib_resubmit_rejected_clients.sql`
- `005_harden_client_linking_and_workflows.sql`
- `006_fix_handle_new_user_trigger.sql`
- `007_allow_ib_insert_approval_log.sql`

Apply them with your normal Supabase workflow, for example:

```bash
supabase db push
```

If you are already live, read `005`, `006`, and `007` before applying because they touch auth/user-linking and approval log policy behavior.

## Run Locally

### Web app

```bash
npm run dev
```

Useful commands:

```bash
npm run check
npm run build
npm run preview
```

### Bridge

Run once:

```bash
cd bridge
python main.py
```

Auto-restart wrapper:

```bash
cd bridge
bash start.sh
```

## One-Time Maintenance Scripts

### Encrypt existing MT5 passwords

If older rows still store plain-text investor passwords:

```bash
npx tsx scripts/encrypt-existing-passwords.ts
```

### Rebuild `daily_stats`

After the per-day stats migration or if historical rows need repair:

```bash
cd bridge
python backfill_daily_stats.py
```

This rebuilds `daily_stats` from existing `trades` and `equity_snapshots`.

## Portfolio Analytics

Client portfolio now includes:

- KPI cards (`balance`, `equity`, `floating P/L`, `profit`)
- Equity chart
- Score breakdown by session
- Recent rhythm card
- Trading calendar
- Analytics dashboard:
  - Sharpe ratio
  - Sortino ratio
  - Calmar ratio
  - Avg daily return
  - Daily volatility
  - Lot distribution
  - Holding-time analysis

## Auth Notes

- Admin and Master IB log in with email/password.
- Client logs in with Google only after the account is approved.
- OAuth callback links at most one approved unlinked client account by normalized email.
- Unauthorized Google signups are deleted and signed out.

## Documentation

- User-facing guide: [`/guide.html`](http://localhost:5173/guide.html) when running locally
- Source file: [static/guide.html](/Users/iphone/Desktop/📁 Projects/TSP/ib-portal/static/guide.html)

## Verification

Recommended before commit/deploy:

```bash
npm run check
npm run build
python3 -m py_compile bridge/main.py bridge/core.py bridge/stats.py bridge/backfill_daily_stats.py
```

## Current Caveats

- `supabase/.temp/` is local CLI state and should not be committed.
- `.DS_Store` is local macOS noise and should not be committed.
- The bridge still relies on a fixed `SERVER_OFFSET` for MT5 timestamps; if broker/server timezone changes, review bridge time handling.
