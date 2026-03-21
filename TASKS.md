# IB-Portal Task Board — TradeZella Feature Parity

> Last updated: 2026-03-21
> Active session: QA-001
> Completed this cycle: 12

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

- [x] [M] TZ-014: Settings — Profile tab
  - Display name, email, avatar
  - Account info (MT5 account, broker, balance)
  - Notification preferences
  - Files: src/routes/settings/profile/+page.svelte (new)

## Notebook Enhancement

- [x] [M] TZ-015: Sessions Recap folder in Notebook
  - Auto-create "Sessions Recap" system folder
  - Generate session recap note after trading day
  - Group by session: Asian, London, New York
  - Files: src/routes/portfolio/notebook/

## Advanced Features

- [x] [L] TZ-016: Economic Calendar integration
  - Fetch events from free API
  - Display: Date, Time, Country, Event, Impact, Actual/Forecast/Previous
  - Filter by country, impact level
  - Files: src/routes/portfolio/calendar/+page.svelte (new)

- [x] [XL] TZ-017: Strategy Templates marketplace
  - "Shared with me" tab in playbook page
  - Browse community templates with performance stats
  - Clone template to own playbooks
  - DB: playbook_templates table
  - Files: src/routes/portfolio/playbook/

- [x] [XL] TZ-018: Trade Replay (Pro feature)
  - Replay trade on chart with entry/exit markers
  - Speed controls (1x, 2x, 5x, pause)
  - P&L curve during replay
  - Requires historical bar data
  - Files: src/routes/portfolio/trades/[id]/replay/+page.svelte (new)

- [x] [M] TZ-019: Import/Export trade history
  - Export: CSV download of filtered trades
  - Import: CSV upload with column mapping
  - Import history log
  - Files: src/routes/api/portfolio/trades/export/, src/routes/api/portfolio/trades/import/

## QA Round — Verify Built Features Match TradeZella

- [x] [L] QA-001: QA Dashboard — compare with TradeZella dashboard
  - Read tradezella-explore/GAP_ANALYSIS.md section 1 (Dashboard)
  - Verify: KPI cards (Net P&L, Win%, Profit Factor, Day Win%, Avg Win/Loss) all present and styled
  - Verify: Cumulative P&L chart works with real data shape
  - Verify: Trading Score Radar has 6 axes
  - Verify: "Start My Day" button works, opens modal with checklist
  - Verify: Currency switcher ($, %, pips) toggles all values
  - Verify: Sync status badge + Sync Now button
  - Fix ANY issues found. Commit fixes.

- [x] [L] QA-002: QA Trade View — compare with TradeZella trade view
  - Read tradezella-explore/GAP_ANALYSIS.md section 3 (Trade View)
  - Verify: Trade table has Quality Score bar column
  - Verify: Trade table has Insights count badge column
  - Verify: Bulk select with checkbox works (select all, individual)
  - Verify: Bulk actions bar (Tag, Review Status, Export CSV) works
  - Verify: Trade detail page has all sections (review, notes, attachments, insights, chart)
  - Fix ANY issues found. Commit fixes.

- [ ] [L] QA-003: QA Reports — compare with TradeZella reports
  - Read tradezella-explore/GAP_ANALYSIS.md section 5 (Reports)
  - Verify: Performance sub-tab with dual configurable charts
  - Verify: Calendar year view with P&L colors
  - Verify: Symbols breakdown table
  - Verify: Compare tool (2 groups)
  - Verify: Tags breakdown sub-tab
  - Verify: Risk analysis sub-tab (drawdown chart, ratios)
  - Verify: Recaps sub-tab (weekly/monthly AI summaries)
  - Fix ANY issues found. Commit fixes.

- [ ] [L] QA-004: QA Day/Week View — compare with TradeZella
  - Read tradezella-explore/GAP_ANALYSIS.md section 2 (Day View)
  - Verify: Day/Week toggle works
  - Verify: Calendar picker highlights profitable/losing days
  - Verify: Week view shows 7-day cards with P&L
  - Verify: Weekly summary stats (trades, win rate, profit factor)
  - Fix ANY issues found. Commit fixes.

- [ ] [L] QA-005: QA Settings pages
  - Verify: Settings layout with sidebar nav (Profile, Security, Trade)
  - Verify: Profile tab (name edit, account info, notification prefs)
  - Verify: Security tab (password change, sessions, 2FA coming soon)
  - Verify: Trade settings (PT/SL defaults, timezone, commission per symbol)
  - Verify: All forms have validation, loading states, success/error messages
  - Fix ANY issues found. Commit fixes.

- [ ] [L] QA-006: QA Notebook, Playbook, Calendar
  - Verify: Notebook folders (All, Daily Journal, Trade Notes, Sessions Recap, My Notes)
  - Verify: Rich text editor works (bold, italic, lists, links)
  - Verify: Search across notes
  - Verify: Playbook templates marketplace (browse, clone, publish)
  - Verify: Economic Calendar (events, filters, impact levels)
  - Verify: Trade Replay (chart, controls, P&L curve)
  - Fix ANY issues found. Commit fixes.

- [ ] [M] QA-007: QA Progress & Discipline
  - Verify: Daily Checklist (manual + automated rules)
  - Verify: Progress heatmap (weekly grid)
  - Verify: Streak counter
  - Verify: Trade Insights engine (10 rules, quality score)
  - Fix ANY issues found. Commit fixes.

- [ ] [L] QA-008: Full app QA — loading skeletons, empty states, mobile
  - Go through EVERY page and verify:
  - Loading skeleton exists and looks good
  - Empty state shows helpful Thai message
  - Mobile layout works (no overflow, readable text, touch targets)
  - No console.log in code
  - No hardcoded English strings (should be Thai)
  - All charts render correctly with 0, 1, and many data points
  - Fix ALL issues found. Commit fixes.

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
### Session 2026-03-21 (continued 9)
- Task: TZ-014 — Settings — Profile tab
- Result: Enhanced /settings profile page with: editable display name (inline edit with save/cancel, API validation 2-100 chars), MT5 account info section (account ID, server, broker, account name, status, last sync with sync count), 4 functional notification toggles (push, daily email, trade alerts, weekly recap) with save/cancel and upsert to user_notification_prefs table. API: POST /api/settings/profile (rate-limited, handles update_name + update_notifications actions). Server: +page.server.ts loads client_accounts + user_notification_prefs in parallel.
- Next: TZ-015
### Session 2026-03-21 (continued 10)
- Task: TZ-015 — Sessions Recap folder in Notebook
- Result: Sessions Recap system folder (already auto-created). New `generate_session_recap` API action: fetches trades for a date, groups by session (Asian/London/New York) using getTradeSession(), generates HTML recap with per-session stats (trade count, P&L, win rate, individual trade details). Duplicate detection (409 if recap exists). UI: date picker + "สร้าง Recap" button shown when Sessions Recap folder is selected, loading spinner, error/duplicate messages in Thai. Mobile responsive: sidebar/editor toggle with back button. Empty state prompt in Thai.
- Next: TZ-016
### Session 2026-03-21 (continued 11)
- Task: TZ-016 — Economic Calendar integration
- Result: New /portfolio/calendar page with Economic Calendar tab. API: GET /api/portfolio/economic-calendar fetches from Forex Factory public JSON feed (rate-limited 10/min, 8s timeout, fallback to empty). UI: week selector (last/this/next week), 4 stats cards (total, high/medium/low impact), search + impact filter + country filter + refresh button, events grouped by date with today highlight, desktop table (time, currency with flag, impact badge, event, forecast/previous/actual) + mobile card layout. Loading skeleton, error state with retry, empty state with filter hint. Thai labels throughout. Dark theme, mobile responsive.
- Next: TZ-017
### Session 2026-03-21 (continued 12)
- Task: TZ-017 — Strategy Templates marketplace
- Result: DB migration 021 creates playbook_templates + playbook_template_clones tables with RLS (public read for published, author CRUD, clone tracking with unique constraint). API: GET/POST/DELETE /api/portfolio/templates (browse/publish/unpublish, rate-limited, performance stats snapshot at publish time), POST /api/portfolio/templates/clone (creates playbook copy, increments clone_count, dedup via unique constraint). UI: Playbook page refactored with "My Playbooks" / "Community Templates" tabs. Community tab: search, category filter (9 categories), sort (popular/newest/win_rate), template cards with stats grid (trades/win rate/P&L), rules preview badges, clone button with loading state + "Clone แล้ว" indicator. Publish modal on own playbooks with category selector. Thai labels, dark theme, mobile responsive.
- Next: TZ-018
### Session 2026-03-21 (continued 13)
- Task: TZ-018 — Trade Replay (Pro feature)
- Result: Dedicated full-page replay at /portfolio/trades/[id]/replay. Server loader fetches trade + chart contexts in parallel. UI: full-height layout with candlestick chart (lightweight-charts) + P&L area curve showing unrealized P&L during trade. Transport controls: play/pause, step forward/backward, reset, scrubber slider. Speed controls (1x/2x/5x/10x). Timeframe switcher for multi-TF chart data. Jump-to-entry/exit buttons. Entry price line + SL/TP price lines appear at entry. Entry/exit arrow markers. Status bar with OHLC, trade phase (PRE-ENTRY/IN TRADE/CLOSED), current P/L, max/min P/L. Keyboard shortcuts (Space=play, arrows=step, R=reset). Trade detail page updated with "Quick Replay" (inline) + "Full Replay" (dedicated page) links. Loading skeleton, empty states, mobile responsive with collapsible info panel. Thai labels, dark theme.
- Next: TZ-019
### Session 2026-03-21 (continued 14)
- Task: TZ-019 — Import/Export trade history
- Result: Export: GET /api/portfolio/trades/export (rate-limited 5/min, returns CSV with 16 columns including pips/commission/swap/SL/TP/tags/review status, date filtering, BOM for Excel). Import: POST /api/portfolio/trades/import (rate-limited 3/min, max 500 rows, CSV parsing with RFC 4180 quote handling, auto-detect column mapping via 30+ aliases like Entry Price=open_price/PnL=profit, custom column_map override, row-level validation with typed errors, batch insert, filename tracking). Import history: GET /api/portfolio/trades/import?history=1 returns last 20 imports. DB: migration 022 creates trade_import_logs table with RLS. UI: TradeImportModal.svelte (4-step wizard: upload→mapping→preview→result), import history panel with status badges, Thai labels. Trades page: Import/Export buttons above stats cards, Export All downloads server-generated CSV.
- Next: QA-001
### Session 2026-03-21 (continued 15)
- Task: QA-001 — QA Dashboard — compare with TradeZella dashboard
- Result: All 8 dashboard features verified present and functional (KPI cards with donut/gauge/bar, Cumulative P&L chart with timeframe picker, Trading Score Radar with 6 axes, Start My Day button + 3-step modal, Currency switcher $/%/pips, Sync status badge, Sync Now button with cooldown). Fixed: translated 20+ English strings to Thai across 7 files (MetricCard labels, chart titles, tooltips, tab navigation, HealthScoreCard labels, TradingScoreRadar label, Sync Now button). All checks pass: build OK, 127 tests pass.
- Next: QA-002
### Session 2026-03-21 (continued 16)
- Task: QA-002 — QA Trade View — compare with TradeZella trade view
- Result: All 5 trade view features verified present and functional (Quality Score bar column, Insights count badge column, bulk select with checkbox, bulk actions bar with Tag/Review Status/Export CSV, trade detail page with all sections: chart, replay, review, notes, tags, attachments, insights, quality score, execution metrics, related trades). Fixed: translated 30+ English strings to Thai across trade list page (stats cards, group-by options, pagination, bulk action review statuses) and trade detail page (price labels, review workflow, form labels/placeholders, section headings, attachment UI, related trades). Added fallback "—" display for empty insights and quality score cells. All checks pass: build OK, 127 tests pass.
- Next: QA-003
