# IB-Portal Task Board — TradeZella Feature Parity

> Last updated: 2026-03-21
> Active session: none
> Completed this cycle: 8

## Status Legend
- [ ] = Ready | [~] = In Progress | [x] = Complete | [!] = Blocked

---

## Infrastructure

- [x] [S] INFRA-001: Install vitest + create vitest.config.ts + add npm test script
- [x] [M] INFRA-002: Write tests for `src/lib/utils.ts`
- [x] [M] INFRA-003: Write tests for `src/lib/portfolio.ts`
- [x] [L] INFRA-004: Write tests for `src/lib/server/portfolio.ts` (buildKpiMetrics, buildDailyHistory)

## Dashboard & UX Enhancements

- [x] [M] TZ-001: Currency/unit switcher ($, %, pips toggle)
  - Add global state store for display unit (Svelte 5 runes)
  - Add switcher dropdown in portfolio layout header
  - Update formatCurrency/formatPercent calls to respect toggle
  - Files: src/lib/stores/displayUnit.ts (new), src/routes/portfolio/+layout.svelte

- [x] [M] TZ-002: "Start My Day" button + flow
  - Add floating button on dashboard overview page
  - Click opens modal: daily checklist review, journal prompt, market summary
  - If checklist done today, show green checkmark
  - Files: src/routes/portfolio/+page.svelte, src/lib/components/portfolio/StartMyDayModal.svelte (new)

- [x] [S] TZ-003: Sync status badge
  - Show "Synced" green badge with last sync time on overview
  - Show "Syncing..." animation when in progress
  - Data: bridge_health table (already exists)
  - Files: src/lib/components/portfolio/SyncStatusBadge.svelte (new)

- [x] [M] TZ-004: Manual sync trigger button + API endpoint
  - "Sync Now" button next to sync status badge
  - API: POST /api/portfolio/sync-trigger
  - Loading spinner while syncing, then refresh
  - Files: src/routes/api/portfolio/sync-trigger/+server.ts (new)

## Trade View Enhancements

- [x] [M] TZ-005: Bulk actions on trades (multi-select + batch operations)
  - Checkbox column in trade explorer table
  - "Select All" checkbox in header
  - Bulk action bar: Tag, Set Review Status, Export CSV
  - Files: src/routes/portfolio/trades/+page.svelte

- [x] [S] TZ-006: Trade quality scale bar in trade table
  - Add "Quality" column showing gradient bar (0-100)
  - Reuse QualityScoreBar.svelte (Phase 4)
  - Files: src/routes/portfolio/trades/+page.svelte

- [x] [S] TZ-007: Insights count badge in trade table
  - Add "Insights" column showing count badge
  - Click navigates to trade detail insights
  - Reuse InsightBadge.svelte
  - Files: src/routes/portfolio/trades/+page.svelte

## Reports & Analytics

- [x] [L] TZ-008: Reports — Tags breakdown sub-tab
  - New sub-tab in analytics: "Tags"
  - Table: Tag, # Trades, Win Rate, Net P&L, Avg P&L, Profit Factor
  - Bar chart: P&L by tag
  - Server: buildTagBreakdown() already exists
  - Files: src/routes/portfolio/analytics/+page.svelte

- [x] [L] TZ-009: Reports — Recaps (Weekly/Monthly AI summaries)
  - New sub-tab in analytics: "Recaps"
  - Auto-generate weekly recap: top winner/loser, patterns, rule breaks
  - Monthly recap: goal progress, consistency trend
  - Use existing OpenAI API infrastructure
  - Files: src/routes/portfolio/analytics/, src/routes/api/portfolio/recaps/

- [x] [M] TZ-010: Reports — Risk analysis sub-tab
  - New sub-tab: "Risk"
  - Max Drawdown chart, Drawdown duration, R:R distribution
  - Sharpe/Sortino/Calmar already calculated, need dedicated view
  - Files: src/routes/portfolio/analytics/+page.svelte

## Settings System

- [x] [L] TZ-011: Settings page — layout + navigation
  - Create /settings route with sidebar nav
  - Tabs: Profile, Security, Trade Settings
  - Dark theme layout pattern
  - Files: src/routes/settings/+layout.svelte (new), src/routes/settings/+page.svelte (new)

- [x] [L] TZ-012: Settings — Security tab
  - Password change form (current + new + confirm)
  - Active sessions list with "Revoke"
  - 2FA toggle (show as "coming soon")
  - Files: src/routes/settings/security/+page.svelte (new)

- [x] [L] TZ-013: Settings — Trade settings tab
  - Default PT/SL values per instrument
  - Timezone preference
  - Commission/fee override per symbol
  - DB: user_trade_settings table (new migration)
  - Files: src/routes/settings/trade/+page.svelte (new)

- [ ] [M] TZ-014: Settings — Profile tab
  - Display name, email, avatar
  - Account info (MT5 account, broker, balance)
  - Notification preferences
  - Files: src/routes/settings/profile/+page.svelte (new)

## Notebook Enhancement

- [ ] [M] TZ-015: Sessions Recap folder in Notebook
  - Auto-create "Sessions Recap" system folder
  - Generate session recap note after trading day
  - Group by session: Asian, London, New York
  - Files: src/routes/portfolio/notebook/

## Advanced Features

- [ ] [L] TZ-016: Economic Calendar integration
  - Fetch events from free API
  - Display: Date, Time, Country, Event, Impact, Actual/Forecast/Previous
  - Filter by country, impact level
  - Files: src/routes/portfolio/calendar/+page.svelte (new)

- [ ] [XL] TZ-017: Strategy Templates marketplace
  - "Shared with me" tab in playbook page
  - Browse community templates with performance stats
  - Clone template to own playbooks
  - DB: playbook_templates table
  - Files: src/routes/portfolio/playbook/

- [ ] [XL] TZ-018: Trade Replay (Pro feature)
  - Replay trade on chart with entry/exit markers
  - Speed controls (1x, 2x, 5x, pause)
  - P&L curve during replay
  - Requires historical bar data
  - Files: src/routes/portfolio/trades/[id]/replay/+page.svelte (new)

- [ ] [M] TZ-019: Import/Export trade history
  - Export: CSV download of filtered trades
  - Import: CSV upload with column mapping
  - Import history log
  - Files: src/routes/api/portfolio/trades/export/, src/routes/api/portfolio/trades/import/

## Polish & Quality

- [ ] [S] POLISH-001: Audit components for missing loading skeletons
- [ ] [S] POLISH-002: Audit mobile responsiveness
- [ ] [M] POLISH-003: Performance audit — lazy load charts
- [ ] [M] POLISH-004: Accessibility audit (ARIA, keyboard nav)
- [ ] [S] POLISH-005: Remove console.log from production code

## Phase 2 — Beyond TradeZella (Competitive Advantage)

- [ ] [L] ADV-001: AI Trade Coach — personalized suggestions based on patterns
  - Analyze last 30 days: win rate by session, common mistakes, best setups
  - Generate daily coaching message on dashboard
  - "Your win rate drops 40% after 2pm — consider stopping earlier"
  - Use existing OpenAI API + trade data
  - Files: src/routes/api/portfolio/ai-coach/+server.ts (new), src/lib/components/portfolio/AiCoachCard.svelte (new)

- [ ] [L] ADV-002: Risk Calculator widget
  - Position size calculator: account balance, risk %, stop loss distance
  - Show recommended lot size + potential P&L
  - Save presets per symbol
  - Files: src/lib/components/portfolio/RiskCalculator.svelte (new)

- [ ] [M] ADV-003: Trade Correlation Matrix
  - Heatmap showing correlation between symbols traded
  - Identify over-exposure to correlated pairs
  - Files: src/routes/portfolio/analytics/ (new sub-tab)

- [ ] [L] ADV-004: Performance Alerts system
  - Configurable alerts: "notify when daily loss > $X", "win rate drops below Y%"
  - Push notification via existing web-push infrastructure
  - Alert rules CRUD
  - Files: src/routes/settings/alerts/+page.svelte (new), src/routes/api/portfolio/alerts/

- [ ] [M] ADV-005: Trade Screenshot annotation
  - Upload chart screenshot to trade
  - Draw arrows, circles, text annotations on image
  - Canvas-based editor
  - Files: src/lib/components/portfolio/ScreenshotAnnotator.svelte (new)

- [ ] [L] ADV-006: Multi-account portfolio view
  - Dashboard showing all accounts side by side
  - Combined P&L across accounts
  - Account comparison metrics
  - Files: src/routes/portfolio/multi-account/+page.svelte (new)

- [ ] [M] ADV-007: Trade Journal Templates
  - Pre-built journal templates: Pre-market, Post-market, Weekly review
  - Template picker when creating new journal entry
  - Auto-fill sections based on today's trades
  - Files: src/lib/components/portfolio/JournalTemplates.svelte (new)

- [ ] [L] ADV-008: Social Trading Feed
  - Share trades/insights with other users (opt-in)
  - Like, comment on shared trades
  - Leaderboard by P&L, win rate, consistency
  - Files: src/routes/portfolio/social/+page.svelte (new), DB: social_posts table

- [ ] [M] ADV-009: Automated Daily Report email
  - End-of-day summary email: P&L, trades, rule breaks, checklist status
  - Weekly digest email
  - Email preferences in settings
  - Files: src/routes/api/portfolio/daily-report/+server.ts (new)

- [ ] [L] ADV-010: Advanced Charting — multi-timeframe analysis
  - Show trade on multiple timeframes (1m, 5m, 15m, 1H, 4H, D)
  - Synchronized crosshair across timeframes
  - Uses lightweight-charts instances
  - Files: src/lib/components/charts/MultiTimeframeChart.svelte (new)

## Phase 3 — Mobile & PWA Enhancement

- [ ] [M] MOB-001: Bottom navigation bar for mobile
  - Fixed bottom nav: Dashboard, Trades, Journal, Analytics, More
  - Hide sidebar on mobile, show bottom nav instead
  - Files: src/lib/components/layout/MobileNav.svelte (new)

- [ ] [M] MOB-002: Swipe gestures for trade cards
  - Swipe left: quick review
  - Swipe right: add tag
  - Touch-friendly trade detail view
  - Files: src/routes/portfolio/trades/+page.svelte

- [ ] [S] MOB-003: Pull-to-refresh on mobile
  - Pull down on portfolio pages to refresh data
  - Show refresh indicator
  - Files: src/routes/portfolio/+layout.svelte

- [ ] [M] MOB-004: Offline mode with service worker
  - Cache recent trades/journal locally
  - Show cached data when offline
  - Sync when back online
  - Files: src/service-worker.ts

- [ ] [M] MOB-005: Quick trade entry from mobile
  - Floating "+" button on mobile
  - Simplified trade form (symbol, side, P&L)
  - For manual trade logging
  - Files: src/lib/components/portfolio/QuickTradeEntry.svelte (new)

---

## Completed
- [x] INFRA-001: Install vitest
- [x] INFRA-002: Tests for utils.ts (33 tests)
- [x] INFRA-003: Tests for portfolio.ts (63 tests, 98 total)
- [x] INFRA-004: Tests for server/portfolio.ts (29 tests, 127 total)

## Session Notes
### Session 2026-03-21
- Task: INFRA-003 — Write tests for src/lib/portfolio.ts
- Result: 63 tests written, 98 total tests pass
- Task: INFRA-004 — Write tests for src/lib/server/portfolio.ts
- Result: 29 tests written (buildDailyHistory + buildKpiMetrics), 127 total tests pass
- Task: TZ-001 — Currency/unit switcher ($, %, pips)
- Result: displayUnit store, formatPnl helper, switcher in layout header, overview KPIs updated
- Next: TZ-002
### Session 2026-03-21 (continued)
- Task: TZ-002 — "Start My Day" button + flow
- Result: StartMyDayModal.svelte (3-step wizard: checklist, journal, market news), floating button with green checkmark when done, checklist+journal data loaded in +page.server.ts
- Next: TZ-003
### Session 2026-03-21 (continued 2)
- Task: TZ-003 — Sync status badge
- Result: SyncStatusBadge.svelte (green Synced/pulsing Syncing.../gray states), bridge_health fetched in layout.server.ts, replaced plain text in layout header
- Next: TZ-004
### Session 2026-03-21 (continued 3)
- Task: TZ-004 — Manual sync trigger button + API endpoint
- Result: POST /api/portfolio/sync-trigger (rate-limited 1/60s, writes sync_requested_at to client_accounts), "Sync Now" button in layout header with spinner + 60s cooldown, invalidates portfolio:baseData on success
- Next: TZ-005
### Session 2026-03-21 (continued 4)
- Task: TZ-005 — Bulk actions on trades
- Result: POST /api/portfolio/trades/bulk (ownership-verified, rate-limited, max 200 trades), checkbox per row + group select-all, sticky bulk action bar with Tag/Review Status/Export CSV actions
- Next: TZ-006
### Session 2026-03-21 (continued 5)
- Task: TZ-010 — Reports — Risk analysis sub-tab
- Result: New "Risk" sub-tab in analytics with: 4 KPI cards (Max Drawdown, Avg Drawdown, Largest Loss, Max Loss Streak), 5 risk-adjusted ratios (Sharpe/Sortino/Calmar/Daily Volatility/Avg Daily Return) with color-coded thresholds, SVG drawdown chart with area fill, top 10 drawdown periods table with recovery tracking, R:R distribution histogram with win/loss breakdown per bucket, daily P&L stats row. Server-side buildRiskAnalysis() computes drawdown series, drawdown periods, R:R distribution, consecutive loss streaks.
- Next: TZ-011
### Session 2026-03-21 (continued 6)
- Task: TZ-011 — Settings page — layout + navigation
- Result: /settings route with layout.server.ts (auth guard), layout.svelte (sidebar nav with Profile/Security/Trade Settings tabs, mobile dropdown, user info card), +page.svelte (Profile tab: avatar, name, email, role, account info, notification prefs placeholder). Settings link added to Sidebar for all roles.
- Next: TZ-012
### Session 2026-03-21 (continued 7)
- Task: TZ-012 — Settings — Security tab
- Result: /settings/security page with: password change form (current+new+confirm, show/hide toggle, validation, loading state), OAuth user detection (shows info message instead of form for Google users), active sessions card with current session + sign-out-all button, 2FA section with "coming soon" badge + disabled toggle, login provider info card with Google icon. API: POST /api/settings/security (rate-limited, verifies current password via signInWithPassword, updates via updateUser).
- Next: TZ-013
### Session 2026-03-21 (continued 8)
- Task: TZ-013 — Settings — Trade settings tab
- Result: /settings/trade page with: timezone selector (17 timezones with Thai labels), default TP/SL inputs (pips), per-symbol settings table (add/edit/remove symbols with custom TP/SL/commission), save button with loading state + success/error messages, empty state for no symbols. API: POST /api/settings/trade (rate-limited, validates timezone/values, upserts to user_trade_settings). DB: migration 020 creates user_trade_settings table with RLS policies + updated_at trigger. symbol_settings stored as JSONB array.
- Next: TZ-014
