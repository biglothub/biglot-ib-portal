# IB-Portal

## Project Overview
IB-Portal is a **B2B trading portfolio management platform** for Introducing Brokers (IBs) and their clients. It connects to MetaTrader 5 via a bridge service, syncs trades/positions/equity, and provides journaling, analytics, AI chat, and coaching features.

## Tech Stack
- **Frontend**: SvelteKit 5 (Runes mode) + Tailwind CSS
- **Backend**: Supabase (Postgres + Row Level Security + Realtime)
- **Charts**: lightweight-charts (TradingView)
- **AI**: OpenAI API (streaming, tool-use for portfolio context)
- **Auth**: Supabase Auth + Google OAuth
- **Language**: TypeScript throughout

## Commands
```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Production build (vite build)
npx svelte-check     # Type check (2 known errors in web-push, ignore)
```

## Architecture

### Route Structure
```
src/routes/
  portfolio/                    # Client portfolio (main feature)
    +layout.svelte              # Tab navigation + AI chat panel
    +layout.server.ts           # Base data loader (trades, stats, journals, playbooks)
    +page.svelte                # Overview dashboard (KPIs, charts, command center)
    day-view/                   # Day/Week view with calendar
    trades/                     # Trade explorer with filtering + grouping
      [id]/                     # Trade detail + review + notes + attachments
    journal/                    # Daily journal with calendar + session recap
    analytics/                  # Analytics + risk metrics
    playbook/                   # Playbook/strategy management
    progress/                   # Goals tracking
    live-trade/                 # Coach schedule
    analysis/                   # AI gold analysis
  api/portfolio/                # API endpoints for mutations
```

### Data Flow
1. `+layout.server.ts` loads ALL base data (trades, dailyStats, journals, playbooks) in parallel
2. Child pages access via `parent()` — no duplicate fetching
3. `buildReportExplorer()` applies filters and computes analytics
4. Mutations go through `/api/portfolio/` endpoints
5. Charts use lightweight-charts for interactive rendering

### Key Server Functions (`src/lib/server/portfolio.ts`)
- `fetchPortfolioBaseData()` — loads all data from Supabase
- `buildDailyHistory()` — aggregates trades by day
- `buildKpiMetrics()` — calculates Net P&L, Win Rate, Day Win%, Avg Win/Loss, Recovery Factor, Consistency
- `buildReportExplorer()` — filters + analytics computation
- `buildSetupPerformance()` — groups by playbook/setup
- `buildRuleBreakMetrics()` — counts broken rules and loss

### Key Client Functions (`src/lib/portfolio.ts`)
- `applyPortfolioFilters()` — client-side trade filtering (12 dimensions)
- `parsePortfolioFilters()` / `buildPortfolioSearchParams()` — URL ↔ filter state

## User Roles
- **Admin**: Manages Master IBs and client approvals
- **Master IB**: Manages clients, views portfolios
- **Client**: Views own portfolio, journals, trades

## Conventions
- Components in `src/lib/components/` organized by domain (`portfolio/`, `charts/`, `shared/`, `layout/`)
- All server-side calculations — no heavy computation on client
- Dark theme UI (bg: `dark-bg`, surface: `dark-surface`, border: `dark-border`, accent: `brand-primary`)
- Thai language for user-facing labels, English for technical terms
- Use `formatCurrency()`, `formatPercent()`, `formatNumber()` from `$lib/utils`
- Use `$derived()` and `$state()` (Svelte 5 Runes), NOT `$:` reactive statements

## Current Development
See `tradezella-explore/DEVELOPMENT_PHASES.md` for the phased enhancement plan.
- Phase 1: Dashboard Enhancement ✅ (KPI cards, Cumulative P&L chart, 6-axis radar)
- Phase 2: Day & Week View ✅ (calendar picker, weekly summary)
- Phase 3: Reports Engine ✅ (Performance, Calendar, Symbols, Compare sub-tabs)
- Phase 4: Trade Insights ✅ (10 rules engine, quality score, UI badges)
- Phase 5: Discipline & Checklist ✅ (daily checklist, progress heatmap, streak)
- Phase 6: Notebook System ✅ → Removed (merged into Journal + Trade Notes)

## Important Notes
- Build has 2 pre-existing type errors in `web-push` — these are not bugs, ignore them
- Git commit requires SSH passphrase — user commits manually
- Never modify `+layout.server.ts` base data loading without understanding the cascade effect
- All new features should work with existing filter system (`PortfolioFilterState`)
- Quality over speed: designed for millions of users, every component needs loading skeleton + empty state + mobile responsive
