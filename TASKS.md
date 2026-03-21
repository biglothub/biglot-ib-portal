# IB-Portal Task Board — TradeZella Feature Parity

> Last updated: 2026-03-22
> Status: Cycle 1 complete (56 tasks). Cycle 2 starting (39 tasks).
> Phase order: SEC → FIX → FEAT → QA2 → POLISH2

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

- [x] [L] QA-003: QA Reports — compare with TradeZella reports
  - Read tradezella-explore/GAP_ANALYSIS.md section 5 (Reports)
  - Verify: Performance sub-tab with dual configurable charts
  - Verify: Calendar year view with P&L colors
  - Verify: Symbols breakdown table
  - Verify: Compare tool (2 groups)
  - Verify: Tags breakdown sub-tab
  - Verify: Risk analysis sub-tab (drawdown chart, ratios)
  - Verify: Recaps sub-tab (weekly/monthly AI summaries)
  - Fix ANY issues found. Commit fixes.

- [x] [L] QA-004: QA Day/Week View — compare with TradeZella
  - Read tradezella-explore/GAP_ANALYSIS.md section 2 (Day View)
  - Verify: Day/Week toggle works
  - Verify: Calendar picker highlights profitable/losing days
  - Verify: Week view shows 7-day cards with P&L
  - Verify: Weekly summary stats (trades, win rate, profit factor)
  - Fix ANY issues found. Commit fixes.

- [x] [L] QA-005: QA Settings pages
  - Verify: Settings layout with sidebar nav (Profile, Security, Trade)
  - Verify: Profile tab (name edit, account info, notification prefs)
  - Verify: Security tab (password change, sessions, 2FA coming soon)
  - Verify: Trade settings (PT/SL defaults, timezone, commission per symbol)
  - Verify: All forms have validation, loading states, success/error messages
  - Fix ANY issues found. Commit fixes.

- [x] [L] QA-006: QA Notebook, Playbook, Calendar
  - Verify: Notebook folders (All, Daily Journal, Trade Notes, Sessions Recap, My Notes)
  - Verify: Rich text editor works (bold, italic, lists, links)
  - Verify: Search across notes
  - Verify: Playbook templates marketplace (browse, clone, publish)
  - Verify: Economic Calendar (events, filters, impact levels)
  - Verify: Trade Replay (chart, controls, P&L curve)
  - Fix ANY issues found. Commit fixes.

- [x] [M] QA-007: QA Progress & Discipline
  - Verify: Daily Checklist (manual + automated rules)
  - Verify: Progress heatmap (weekly grid)
  - Verify: Streak counter
  - Verify: Trade Insights engine (10 rules, quality score)
  - Fix ANY issues found. Commit fixes.

- [x] [L] QA-008: Full app QA — loading skeletons, empty states, mobile
  - Go through EVERY page and verify:
  - Loading skeleton exists and looks good
  - Empty state shows helpful Thai message
  - Mobile layout works (no overflow, readable text, touch targets)
  - No console.log in code
  - No hardcoded English strings (should be Thai)
  - All charts render correctly with 0, 1, and many data points
  - Fix ALL issues found. Commit fixes.

## Polish & Quality

- [x] [S] POLISH-001: Audit components for missing loading skeletons
- [x] [S] POLISH-002: Audit mobile responsiveness
- [x] [M] POLISH-003: Performance audit — lazy load charts
- [x] [M] POLISH-004: Accessibility audit (ARIA, keyboard nav)
- [x] [S] POLISH-005: Remove console.log from production code

## Phase 2 — Beyond TradeZella (Competitive Advantage)

- [x] [L] ADV-001: AI Trade Coach — personalized suggestions based on patterns
  - Analyze last 30 days: win rate by session, common mistakes, best setups
  - Generate daily coaching message on dashboard
  - "Your win rate drops 40% after 2pm — consider stopping earlier"
  - Use existing OpenAI API + trade data
  - Files: src/routes/api/portfolio/ai-coach/+server.ts (new), src/lib/components/portfolio/AiCoachCard.svelte (new)
  - Session note: POST endpoint analyzes 30d trades (session/hour/rule/setup stats), calls gpt-4o-mini with json_object response_format. Component has 24h localStorage cache + rate-limited refresh. Integrated into dashboard above recent trades table.

- [x] [L] ADV-002: Risk Calculator widget
  - Position size calculator: account balance, risk %, stop loss distance
  - Show recommended lot size + potential P&L
  - Save presets per symbol
  - Files: src/lib/components/portfolio/RiskCalculator.svelte (new)
  - Session note: Pure client-side calculator. Inputs: symbol, account balance (auto-filled from latestStats.balance), risk % slider (0.1–5%), SL pips, TP pips, pip value. Outputs: lot size, risk amount, potential profit, R:R ratio with color coding. Presets saved per symbol in localStorage. Integrated into dashboard alongside AiCoachCard in a 2-column grid.

- [x] [M] ADV-003: Trade Correlation Matrix
  - Heatmap showing correlation between symbols traded
  - Identify over-exposure to correlated pairs
  - Files: src/routes/portfolio/analytics/ (new sub-tab)
  - Session note: Pearson r correlation on daily P&L per symbol pair. Server-side buildCorrelationMatrix() added to +page.server.ts. Client: new "ความสัมพันธ์" sub-tab with color-coded matrix (red=high positive/risky, blue=negative/hedge, gray=no correlation), hover tooltip, top pairs ranked list with warning badge for r≥0.7.

- [x] [L] ADV-004: Performance Alerts system
  - Configurable alerts: "notify when daily loss > $X", "win rate drops below Y%"
  - Push notification via existing web-push infrastructure
  - Alert rules CRUD
  - Files: src/routes/settings/alerts/+page.svelte (new), src/routes/api/portfolio/alerts/
  - Session note: DB migration 023_performance_alerts.sql (5 alert types: daily_loss, daily_profit_target, win_rate_drop, drawdown, loss_streak). CRUD API at /api/portfolio/alerts (GET/POST/DELETE). Evaluation engine at /api/portfolio/alerts/evaluate (computes metrics from daily_stats + trades, 1h cooldown per alert, fires push via shared $lib/server/push.ts utility). Settings page at /settings/alerts with add/toggle/delete UI. "ตรวจสอบตอนนี้" button for on-demand evaluation. Added tab to settings layout sidebar.

- [x] [M] ADV-005: Trade Screenshot annotation
  - Upload chart screenshot to trade
  - Draw arrows, circles, text annotations on image
  - Canvas-based editor
  - Files: src/lib/components/portfolio/ScreenshotAnnotator.svelte (new)
  - Session note: Canvas modal with 5 tools (arrow, circle, rectangle, pen, text), 8 preset colors, line-width slider, undo/clear. Image upload via file input → HTMLImage on canvas, max 1280px wide. Export as PNG blob → FormData POST to /api/portfolio/trades/[id]/attachments/upload → Supabase Storage bucket 'trade-screenshots' (private, signed 10-year URLs). Stored as kind='screenshot'. Trade detail page shows inline image previews for screenshots and image_url attachments. New migration 024 creates storage bucket + RLS + expands kind check constraint.

- [x] [L] ADV-006: Multi-account portfolio view
  - Dashboard showing all accounts side by side
  - Combined P&L across accounts
  - Account comparison metrics
  - Files: src/routes/portfolio/multi-account/+page.svelte (new)
  - Session note: Server loads ALL approved accounts via RLS (no user_id filter needed — Supabase filters by auth.uid()), computes per-account summary (netPnl, winRate, profitFactor, balance, todayPnl, maxDrawdown) via parallel queries. Page shows: combined summary banner (5 metrics), side-by-side bar chart comparing Net P&L, card grid per account, full comparison table. Single-account state shows "only one account" helper. Admin view blocked with message.

- [x] [M] ADV-007: Trade Journal Templates
  - Pre-built journal templates: Pre-market, Post-market, Weekly review
  - Template picker when creating new journal entry
  - Auto-fill sections based on today's trades
  - Files: src/lib/components/portfolio/JournalTemplates.svelte (new)
  - Session note: Modal with 3 template cards (ก่อนเปิดตลาด, หลังปิดตลาด, ทบทวนรายสัปดาห์). Post-market template auto-fills postMarketNotes with wins/losses/P&L/symbols from dayTrades. "ใช้ Template" button in journal editor header opens modal. Applying template overwrites only fields defined by that template. Radio selection UI, color-coded cards per template type.

- [x] [L] ADV-008: Social Trading Feed
  - Share trades/insights with other users (opt-in)
  - Like, comment on shared trades
  - Leaderboard by P&L, win rate, consistency
  - Files: src/routes/portfolio/social/+page.svelte (new), DB: social_posts table
  - Session note: DB migration 025 — social_settings (opt-in), social_posts (3 types: insight/trade_share/milestone), social_likes (toggle), social_comments. Triggers keep likes_count/comments_count in sync. SECURITY DEFINER function get_social_leaderboard() bypasses trades RLS for cross-user stats. 5 API endpoints under /api/portfolio/social (feed CRUD, like toggle, comments CRUD, leaderboard GET, settings upsert). Page at /portfolio/social with Feed + Leaderboard tabs, opt-in banner, create post form, like/comment UI, mini leaderboard sidebar. Tab added to portfolio layout nav.

- [x] [M] ADV-009: Automated Daily Report email
  - End-of-day summary email: P&L, trades, rule breaks, checklist status
  - Weekly digest email
  - Email preferences in settings
  - Files: src/routes/api/portfolio/daily-report/+server.ts (new)
  - Session note: DB migration 026_email_reports.sql (email_report_settings table with daily/weekly toggles, send_hour, weekly_day, rate-limiting timestamps). Email sending via Resend REST API (no new package — uses fetch). HTML email templates: buildDailyReportHtml (P&L hero, KPI grid, top winner/loser, discipline row, CTA) and buildWeeklyDigestHtml (summary stats 4-col grid, top symbol, discipline). API at /api/portfolio/daily-report (GET settings, PUT upsert, POST send now/test). Settings page at /settings/email-reports with toggle cards for daily + weekly, send-hour select, "ส่งทดสอบ" button per type. Tab added to settings sidebar. Requires RESEND_API_KEY + RESEND_FROM_EMAIL in env (documented in .env.example).

- [x] [L] ADV-010: Advanced Charting — multi-timeframe analysis
  - Show trade on multiple timeframes (1m, 5m, 15m, 1H, 4H, D)
  - Synchronized crosshair across timeframes
  - Uses lightweight-charts instances
  - Files: src/lib/components/charts/MultiTimeframeChart.svelte (new)
  - Session note: Svelte action `chartPanel` initialises one lightweight-charts candlestick instance per context. Shared `instances[]` array + `syncCrosshair()` propagates vertical crosshair across all open charts via `setCrosshairPosition` / `clearCrosshairPosition`. Grid mode (2-col responsive) auto-heights panels; ResizeObserver resizes charts on layout change. Click ⤢ focuses single TF at 380px with pill-tab switcher. Entry/exit arrowUp/arrowDown markers + dashed SL/TP price lines on every TF. Replaces TradeContextChart in trade detail page. 127 tests pass, build OK.

## Phase 3 — Mobile & PWA Enhancement

- [x] [M] MOB-001: Bottom navigation bar for mobile
  - Fixed bottom nav: Dashboard, Trades, Journal, Analytics, More
  - Hide sidebar on mobile, show bottom nav instead
  - Files: src/lib/components/layout/MobileNav.svelte (new)
  - Session note: Fixed `bottom-0` nav bar (md:hidden) with 4 primary tabs (ภาพรวม, เทรด, บันทึก, รายงาน) + "เพิ่มเติม" button. More button opens slide-up grid drawer with remaining 9 tabs (4-col grid). Horizontal tab bar in portfolio layout is now `hidden md:flex`. Added `pb-16 md:pb-0` to layout container. MobileNav receives `tabs[]` + `isActive()` from layout — respects admin view account_id in hrefs. Build OK.

- [x] [M] MOB-002: Swipe gestures for trade cards
  - Swipe left: quick review
  - Swipe right: add tag
  - Touch-friendly trade detail view
  - Files: src/routes/portfolio/trades/+page.svelte
  - Session note: SwipeableTradeCard.svelte — Svelte action with non-passive touchmove listener detects horizontal vs vertical intent (8px lock threshold). Left swipe (≥72px) opens Quick Review bottom sheet (3-state selector). Right swipe opens Add Tag bottom sheet (tag pill grid). Both sheets use full-width backdrop + rounded-t-2xl panel. Mobile card list shown md:hidden inside each group; existing desktop table wrapped in hidden md:block. 127 tests pass, build OK.

- [x] [S] MOB-003: Pull-to-refresh on mobile
  - Pull down on portfolio pages to refresh data
  - Show refresh indicator
  - Files: src/routes/portfolio/+layout.svelte
  - Session note: Touch event listeners attached via $effect (non-passive touchmove to allow preventDefault). Only triggers when scrollY=0. 72px threshold; visual indicator is a fixed circle at top-center with sync icon that rotates as you pull (opacity+rotation tracks pullProgress) then spins (animate-spin + brand-primary) during refresh. Content div gets subtle translateY (max 24px) for physical pull feel. Calls invalidate('portfolio:baseData') on release. Cleans up listeners on component destroy. Build OK.

- [x] [M] MOB-004: Offline mode with service worker
  - Cache recent trades/journal locally
  - Show cached data when offline
  - Sync when back online
  - Files: src/service-worker.ts
  - Session note: Enhanced service worker with stale-while-revalidate strategy for /portfolio/* navigation requests (DATA_CACHE 'portfolio-pages-v1'). Cached pages served instantly when offline; network response updates cache in background. Offline page at /routes/offline/+page.svelte enhanced with dark theme, Thai copy, "what you can do offline" tips list, and link to /portfolio. Portfolio layout (+layout.svelte) adds: offline banner (fixed top bar "ออฟไลน์ — กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด") when navigator.onLine=false, reconnected toast ("เชื่อมต่อแล้ว — กำลังอัปเดตข้อมูล") auto-dismissed after 4s + triggers invalidate('portfolio:baseData') to refresh. 127 tests pass, build OK.

- [x] [M] MOB-005: Quick trade entry from mobile
  - Floating "+" button on mobile
  - Simplified trade form (symbol, side, P&L)
  - For manual trade logging
  - Files: src/lib/components/portfolio/QuickTradeEntry.svelte (new)
  - Session note: Floating "+" FAB (bottom-right, bottom-20 above mobile nav, md:hidden). Tapping opens bottom-sheet modal with swipe-down-to-dismiss. Form fields: symbol, BUY/SELL toggle (color-coded green/red), P&L ($), lot size, open/close datetime-local. Optional advanced section (open/close price, SL, TP) behind collapsible toggle. Validation: symbol required, P&L must be a number, close time ≥ open time. Success state shows green checkmark + auto-closes after 2s + invalidates portfolio:baseData. API: POST /api/portfolio/trades/manual (rate-limited 20/min, client-only, inserts with position_id=0, commission=0, swap=0, defaults). Hidden in admin view. 127 tests pass, build OK.

---

## Cycle 2 — Security, Bug Fixes, Feature Gaps, QA, Polish

### Security (CRITICAL — blocks production)

- [x] [M] SEC-001: Fix Prompt Injection in AI Chat
  - Validate msg.role at runtime in ai-chat/+server.ts
  - Only allow role: 'user' from client, reject 'system'/'assistant'
  - Add input validation for message content length
  - Files: src/routes/api/portfolio/ai-chat/+server.ts
  - Session: 2026-03-22 — Added strict message alternation validation (user→assistant→user), rejects 'system'/'tool' roles, content truncated at 2000 chars, rate limiting already in place

- [x] [S] SEC-002: Fix IDOR in Journal API
  - journal/+server.ts uses body parameter for account_id
  - Must use server-verified account.id from authenticated session
  - Test: try writing to another user's journal — should fail
  - Files: src/routes/api/portfolio/journal/+server.ts
  - Session: Already fixed in commit e2e6a0b — client_account_id now comes from getApprovedPortfolioAccount() not request body

- [x] [S] SEC-003: Fix PostgREST Filter Injection in Notebook search
  - notebook/+server.ts passes raw search query to PostgREST .or() filter
  - Escape PostgREST special operators (., (), *) from user input
  - Or use parameterized query instead of string interpolation
  - Files: src/routes/api/portfolio/notebook/+server.ts
  - Session: 2026-03-22 — Replaced blacklist escapePostgrestValue with whitelist sanitizeSearchQuery (Unicode \p{L}\p{N} + safe chars only), added type check, 100-char length limit, and empty-after-sanitize guard

- [x] [S] SEC-004: Fix trade_insights RLS — too permissive
  - Current: USING(true) WITH CHECK(true) — any user can read/write any row
  - Create new migration: restrict SELECT/UPDATE to trade owner via trades join
  - Files: supabase/migrations/ (new migration)
  - Session: 2026-03-22 — Already fixed in migration 017_fix_security_issues.sql: dropped dangerous "Service can manage trade insights" FOR ALL policy, added proper SELECT-only policy using is_own_account()

- [x] [S] SEC-005: Fix Role Injection in handle_new_user()
  - User can set admin role via signup metadata raw_user_meta_data->>'role'
  - Always default to 'client' regardless of metadata
  - Create new migration to fix the trigger function
  - Files: supabase/migrations/ (new migration)
  - Session: 2026-03-22 — Already fixed in migration 017_fix_security_issues.sql: handle_new_user() now always defaults role to 'client'

- [x] [M] SEC-006: Fix mt5_investor_password exposed via RLS
  - Client SELECT policy on client_accounts includes encrypted password column
  - Create a view that excludes sensitive columns, or use column-level security
  - Files: supabase/migrations/ (new migration)
  - Session: 2026-03-22 — Already fixed in migration 017_fix_security_issues.sql: REVOKE SELECT on mt5_investor_password column from authenticated and anon roles

- [x] [M] SEC-007: Fix XSS in analysis and AI chat pages
  - {@html} used without DOMPurify sanitization
  - Install DOMPurify: npm install dompurify @types/dompurify
  - Create sanitizeHtml() helper, apply to all {@html} usage
  - Audit: grep -r '{@html' src/ to find all instances
  - Files: src/lib/utils.ts, all files using {@html}
  - Session: 2026-03-22 — Installed DOMPurify, created sanitizeHtml() in $lib/utils with allowlist of safe tags/attrs, applied to all 3 markdown-rendering {@html} instances (AiChatMessage, analysis, analytics). Hardcoded SVG icons left as-is (no user input). Also marked SEC-004/005/006 as done (already fixed in migration 017)

- [x] [M] SEC-008: Add rate limiting middleware
  - 13+ mutation endpoints have no rate limiting
  - Create reusable rateLimit() helper (in-memory Map with TTL)
  - Apply to: journal, notebook, playbook, tags, social, alerts, ai-coach, ai-chat
  - Files: src/lib/server/rateLimit.ts (new), multiple API routes
  - Session: 2026-03-22 — Existing rateLimit() helper already covered most endpoints. Added rate limiting to 9 remaining unprotected files: social feed (POST 10/60s, DELETE 10/60s), social like (POST 30/60s), social comments (POST/DELETE 20/60s), social settings (POST 10/60s), alerts (POST/DELETE 20/60s), alerts evaluate (POST 5/60s), daily-report (PUT 10/60s, POST 3/60s), push subscribe (POST/DELETE 10/60s), push send (POST 10/60s). All mutation endpoints now have rate limiting.

### Bug Fixes (High Priority)

- [x] [S] FIX-001: Fix $derived() misuse — should be $derived.by()
  - Audit all $derived() calls across components
  - $derived(expression) is for simple expressions
  - $derived.by(() => { ... }) is for multi-line/complex computations
  - Fix any misuse found
  - Files: grep -r '\$derived(' src/ to find all instances
  - Session: 2026-03-22 — Fixed 6 real bugs where $derived(() => { ... }) stored the function instead of its result (SidebarNews, TagManager, social, playbook, calendar, journal). Also fixed 5 template call sites that used variable() because it was a function. Converted 13 IIFE patterns $derived((() => { ... })()) to idiomatic $derived.by(() => { ... }) across charts, analytics, notebook, day-view, MiniCalendar, ProgressHeatmap, and trade detail. 19 total fixes.

- [x] [S] FIX-002: Fix memory leaks — timers not cleaned in notebook
  - notebook/+page.svelte has setInterval for auto-save without cleanup
  - Wrap in $effect with return cleanup function, or use onDestroy
  - Files: src/routes/portfolio/notebook/+page.svelte
  - Session: 2026-03-22 — Added $effect cleanup that clears both saveTimer (auto-save debounce) and searchTimer (search debounce) on component destroy. Prevents stale timer callbacks firing after navigation away from notebook page.

- [x] [S] FIX-003: Fix memory leak — unsubscribed store subscriptions
  - Some components subscribe to stores without unsubscribing
  - Use $ prefix for auto-subscription or add explicit unsubscribe
  - Audit: components importing stores and calling .subscribe()
  - Files: multiple components
  - Session: 2026-03-22 — Audited all .subscribe() calls in src/. Found one leak: SidebarNews.svelte called marketNewsStore.subscribe() at module scope without cleanup. Fixed by wrapping in $effect() with unsubscribe return. Other .subscribe() calls (chart crosshair, Supabase realtime, Web Push API) were already properly cleaned up.

- [x] [M] FIX-004: Fix admin dashboard unbounded query
  - Fetches ALL daily_stats with no date limit — O(n) grows forever
  - Add default date range filter (last 90 days)
  - Add pagination for client lists
  - Files: src/routes/admin/+page.server.ts
  - Session: 2026-03-22 — Added 90-day date filter (.gte('date', ninetyDaysAgo)) to daily_stats query in admin +page.server.ts. This bounds the AUM calculation to recent data instead of fetching every row ever. Client list pagination not needed on this page (lists are on /admin/approvals and /admin/ibs).

- [x] [S] FIX-005: Fix Math.max(...largeArray) stack overflow risk
  - Math.max/Math.min with spread on large arrays can exceed call stack
  - Replace with reduce: arr.reduce((max, v) => v > max ? v : max, -Infinity)
  - Audit: grep -r 'Math\.\(max\|min\)(\.\.\.' src/
  - Files: src/lib/server/portfolio.ts

- [x] [M] FIX-006: Fix keyboard accessibility on trade rows
  - Trade table rows are not keyboard navigable
  - Add tabindex="0" to interactive rows
  - Add onkeydown handler (Enter/Space → navigate to trade detail)
  - Add visible focus ring styles
  - Files: src/routes/portfolio/trades/+page.svelte
  - ✅ Session 2026-03-22: Added tabindex="0", role="link", aria-label to <tr>; handleRowKeydown for Enter/Space; focus-visible ring; moved onclick to <tr> level with checkbox exclusion; removed duplicate cursor-pointer from <td>

- [x] [S] FIX-007: Fix analysis streaming — add AbortController
  - AI analysis streaming has no abort signal
  - If user navigates away mid-stream, fetch continues in background
  - Add AbortController, abort on component destroy
  - Files: src/routes/portfolio/analysis/+page.svelte
  - ✅ Session 2026-03-22: Added AbortController to generateAnalysis(); signal passed to fetch; abort on component destroy via onMount cleanup; abort previous request on re-generate; AbortError silently ignored in catch

- [x] [S] FIX-008: Fix NotificationBell — add error handling
  - Notification API calls have no try/catch
  - Add error handling with fallback UI
  - Files: src/lib/components/layout/NotificationBell.svelte
  - ✅ Session 2026-03-22: Added try/catch to all 3 Supabase calls (fetch, markAsRead, markAllAsRead); added loading skeleton (3 animated placeholders); added error state with Thai message + retry button; optimistic update with rollback on markAllAsRead; Supabase error objects properly checked

- [x] [S] FIX-009: Fix push notification URL validation
  - Service worker opens URLs from push data without validation
  - Validate URL is same-origin before opening
  - Files: src/service-worker.ts
  - ✅ Session 2026-03-22: Added `validateSameOriginUrl()` function that parses URLs and checks origin matches `sw.location.origin`; validates at both push receive (data storage) and notificationclick (before openWindow); falls back to '/' for invalid or cross-origin URLs; returns pathname+search+hash only to prevent protocol-level attacks

- [x] [M] FIX-010: Fix DayMiniPnlChart data reactivity
  - Chart doesn't update when underlying data changes
  - Add $effect to watch data prop changes and re-render chart
  - Files: src/lib/components/charts/DayMiniPnlChart.svelte
  - ✅ Session 2026-03-22: Extracted `updateChartData()` helper that updates series data and colors (green/red based on last value); called from both `onMount` (initial render) and `$effect` (reactive updates when data prop changes); chart creation separated from data setting for clean reactivity

### Feature Gaps vs TradeZella

- [x] [M] FEAT-001: Expand Trading Score Radar to 6 axes
  - Current: 3 axes (win_rate, profit_factor, avg_win_loss)
  - Add: Recovery Factor, Max Drawdown (inverted), Consistency Score
  - Update server calculation in buildKpiMetrics or dedicated function
  - Update TradingScoreRadar.svelte SVG to draw 6-axis radar
  - Files: src/lib/components/portfolio/TradingScoreRadar.svelte, src/lib/server/portfolio.ts

- [x] [S] FEAT-002: Add Day Win % KPI card on dashboard
  - Calculate: profitable trading days / total trading days
  - Display as donut/ring chart like TradeZella (e.g., "57.58%")
  - Use dailyStats data already loaded in +page.server.ts
  - Files: src/routes/portfolio/+page.svelte, src/routes/portfolio/+page.server.ts

- [x] [S] FEAT-003: Add Avg Win/Loss Ratio KPI card with bar visual
  - Show avg win $ vs avg loss $ as side-by-side bars
  - Data already calculated in buildKpiMetrics (avgWin, avgLoss)
  - Visual: green bar (avg win) vs red bar (avg loss) with ratio label
  - Files: src/routes/portfolio/+page.svelte

- [x] [M] FEAT-004: Add Date Range Filter to dashboard overview
  - Dashboard overview currently shows all-time data
  - Add date picker (same component used in trades page)
  - Filter dailyStats and trades by selected range
  - Recalculate KPIs for filtered period
  - Files: src/routes/portfolio/+page.svelte, src/routes/portfolio/+page.server.ts

- [x] [L] FEAT-005: Complete Trade Insights auto-detection engine
  - Current: trade_insights table exists, basic rules
  - Implement 20+ pattern detection rules:
    - Revenge trading (loss → quick re-entry same symbol)
    - Overtrading (>N trades per day)
    - Holding too long / cutting too short
    - News trading without stop loss
    - Session-specific patterns (win rate drop in certain sessions)
    - Risk management violations (position too large, no SL)
  - Auto-run on trade sync or manual trigger
  - Files: src/lib/server/insights/engine.ts

- [x] [M] FEAT-006: Populate Zella Scale (Trade Quality Score)
  - QualityScoreBar component exists but has no scoring logic
  - Create scoring algorithm based on:
    - Trade review scores (setup quality, discipline, execution)
    - Rule breaks (penalty)
    - Risk-reward ratio achieved vs planned
    - Whether trade followed playbook
  - Auto-calculate on trade review save
  - Files: src/lib/server/insights/, trade detail page

- [x] [S] FEAT-007: Add PDF Export button in Analytics
  - API endpoint exists: /api/portfolio/reports/export-pdf
  - Add "Export PDF" button in analytics page header/toolbar
  - Wire button to call API, download resulting PDF
  - Files: src/routes/portfolio/analytics/+page.svelte

- [x] [M] FEAT-008: Add Manual Checklist Rules
  - Current: only automated rules (linked playbook %, trade has SL, etc.)
  - Add UI to create custom rules: "Meditation", "Exercise", "Review previous day"
  - Each rule has: name, description, type (manual)
  - User manually checks off each day
  - Track completion rate per rule in progress heatmap
  - Files: src/routes/portfolio/progress/+page.svelte, API endpoint

- [x] [L] FEAT-009: Enhance Settings Security tab
  - Current: basic password change form + sessions placeholder
  - Add: functional active sessions list from Supabase auth
  - Add: "Sign out all other devices" button
  - Add: 2FA setup flow (show QR code, verify code) or "coming soon" with better UI
  - Add: login history table (last 10 logins with IP/device)
  - Files: src/routes/settings/security/+page.svelte

- [x] [S] FEAT-010: Add visible Manual Sync Button on dashboard overview
  - API exists (/api/portfolio/sync-trigger) and button is in layout header
  - Add more visible "Sync Now" card/button on dashboard overview page
  - Show last sync time, sync status, next scheduled sync
  - Files: src/routes/portfolio/+page.svelte

- [x] [L] FEAT-011: Upgrade Journal to Rich Text Editor
  - Current: plain textarea fields for journal entries
  - Upgrade to TiptapEditor (already used in Notebook)
  - Migrate form fields: preMarketNotes, duringMarketNotes, postMarketNotes
  - Keep mood/energy/discipline/confidence sliders as-is
  - Files: src/routes/portfolio/journal/+page.svelte
  - Session: 2026-03-22 — Replaced 5 textarea fields (preMarketNotes, sessionPlan, postMarketNotes, lessons, tomorrowFocus) with TiptapEditor in compact mode. Added compact prop to TiptapEditor (reduced min-height, simplified toolbar). Added toHtml() helper for backward compatibility with existing plain text data. Fixed pre-existing setContent type error. Kept marketBias/keyLevels as single-line inputs, mood/energy/discipline/confidence sliders unchanged.

- [x] [M] FEAT-012: Strategy Templates Marketplace UI
  - playbook_templates table exists with data
  - Build browse interface: search, filter by category
  - Template preview card with: name, description, performance stats, creator
  - "Clone to My Playbooks" button
  - Files: src/routes/portfolio/playbook/+page.svelte

### QA Round 2

- [x] [L] QA2-001: QA Security fixes — verify all SEC-001 to SEC-008
  - Test prompt injection blocked (SEC-001)
  - Test IDOR blocked — can't write to other user's journal (SEC-002)
  - Test search injection sanitized (SEC-003)
  - Test RLS policies correct for trade_insights (SEC-004)
  - Test signup always creates 'client' role (SEC-005)
  - Test mt5_investor_password not in SELECT results (SEC-006)
  - Test {@html} content sanitized (SEC-007)
  - Test rate limiting blocks excessive requests (SEC-008)
  - Session: 2026-03-22 — Created 68 unit tests in src/lib/__tests__/security.test.ts covering:
    - SEC-001: 21 tests — role whitelist (rejects system/tool/function), strict alternation enforcement, content length truncation, format validation
    - SEC-003: 14 tests — whitelist filtering (allows alphanumeric + Thai + hyphens), strips PostgREST operators (dots/parens/commas), SQL LIKE wildcard escaping, injection vector testing
    - SEC-007: 20 tests — allows safe tags (strong/em/code/table/link), strips script/iframe/embed/form/object, blocks onclick/onload/javascript: protocol
    - SEC-008: 7 tests — allows within limit, blocks excess, resets after window, key isolation, boundary testing
    - SEC-002/004/005/006: DB-level fixes (RLS, trigger function, column security) — verified via code review, not unit-testable without real DB
    - Refactored: extracted validateChatMessages() and sanitizeSearchQuery() into $lib/server/validation.ts for testability

- [x] [L] QA2-002: QA Advanced features (ADV-001 to ADV-010) end-to-end
  - AI Coach: verify coaching message generates with real data
  - Risk Calculator: verify calculations correct
  - Correlation Matrix: verify heatmap renders
  - Performance Alerts: verify alert creation, evaluation, push
  - Screenshot Annotator: verify upload, annotate, save
  - Multi-account: verify accounts load, comparison works
  - Journal Templates: verify template apply fills fields
  - Social Feed: verify post/like/comment/leaderboard
  - Daily Report: verify email template renders
  - Advanced Charts: verify multi-timeframe sync
  - Session: 2026-03-22 — Created 91 QA tests in src/lib/__tests__/adv-features.test.ts covering:
    - ADV-001: 5 tests — session stats, 3-hour blocks, min trade count, profitFactor cap
    - ADV-002: 10 tests — lot size calc, R:R ratio, zero edge cases, gold pip value
    - ADV-003: 8 tests — Pearson r (+1/-1/0/null), matrix symmetry, high-corr warning
    - ADV-004: 14 tests — cooldown logic, all 5 alert types, null metrics, unknown type
    - ADV-005: 7 tests — arrow/ellipse/rect geometry, canvas scaling, undo stack, file validation
    - ADV-006: 6 tests — combined metrics sum, single/zero accounts, profitFactor cap
    - ADV-007: 5 tests — post-market auto-fill, symbol dedup, empty/negative P&L, null profit
    - ADV-008: 7 tests — post type validation, content limit, avatar hash, leaderboard sort, pagination
    - ADV-009: 7 tests — daily report HTML (positive/negative P&L, infinity PF, unsubscribe link), weekly digest
    - ADV-010: 8 tests — TF ordering, labels, entry/exit markers, SL/TP lines, chart heights
    - Cross-feature: 3 tests — KPI metrics, rule break counting, journal completion summary
    - BUG FIXED: daily-report/+server.ts used `ruleBreaks.totalBreaks` instead of `ruleBreaks.totalRuleBreaks` (2 occurrences)

- [ ] [L] QA2-003: QA Mobile features (MOB-001 to MOB-005)
  - Test at 375px viewport width
  - Bottom nav: all tabs accessible, active state correct
  - Swipe gestures: left=review, right=tag, smooth animation
  - Pull-to-refresh: indicator shows, data refreshes
  - Offline mode: disconnect network, cached pages load, reconnect toast
  - Quick trade entry: FAB visible, form validates, submit works

- [ ] [M] QA2-004: QA Cross-page consistency
  - Same loading skeleton pattern on all pages
  - Same empty state pattern (icon + Thai message + action button)
  - Same error state pattern (error icon + retry button)
  - Same card/panel styling (dark-surface, dark-border, rounded-xl, p-6)
  - Same button styles and sizes
  - Same table/list patterns
  - Fix inconsistencies found

### Final Polish

- [ ] [M] POLISH2-001: Consistent loading skeletons across all pages
  - Audit every page for loading skeleton
  - Ensure same animation style (animate-pulse)
  - Same skeleton card height/layout per content type

- [ ] [M] POLISH2-002: Consistent empty states with Thai messages
  - Every list/table needs empty state
  - Pattern: icon + Thai message + optional CTA button
  - Audit all pages, add missing empty states

- [ ] [M] POLISH2-003: Responsive audit — test every page at 375px
  - No horizontal overflow
  - Text readable (min 14px)
  - Touch targets min 44x44px
  - Cards stack vertically on mobile
  - Tables scroll horizontally or convert to cards

- [ ] [S] POLISH2-004: Remove any remaining console.log
  - grep -r 'console\.log' src/ — remove all
  - Keep console.error for actual error reporting

- [ ] [M] POLISH2-005: Animation & transition polish
  - Page transitions smooth
  - Modal open/close animated
  - Hover states on all interactive elements
  - Focus rings visible for keyboard nav
  - Chart animations smooth

---

## Completed (Cycle 1)
- [x] INFRA-001: Install vitest
- [x] INFRA-002: Tests for utils.ts (33 tests)
- [x] INFRA-003: Tests for portfolio.ts (63 tests, 98 total)
- [x] INFRA-004: Tests for server/portfolio.ts (29 tests, 127 total)

## Session Notes
### Session 2026-03-21 (MOB-005)
- Task: MOB-005 — Quick trade entry from mobile
- Result: QuickTradeEntry.svelte — floating "+" FAB above mobile nav bar, bottom-sheet modal with swipe-down dismiss. Form: symbol, BUY/SELL toggle, P&L, lot size, open/close datetime, advanced section (prices, SL, TP). API: POST /api/portfolio/trades/manual (rate-limited, client-only). Success state with auto-close. Integrated in portfolio layout, hidden in admin view. 127 tests pass, build OK.
- Next: All tasks complete — Phase 3 Mobile & PWA done

### Session 2026-03-21 (ADV-010)
- Task: ADV-010 — Advanced Charting multi-timeframe analysis
- Result: MultiTimeframeChart.svelte (src/lib/components/charts/). Svelte action pattern per panel, shared crosshair sync, 2-col responsive grid, focus/expand mode with pill tabs. Replaces TradeContextChart in trades/[id]/+page.svelte. 127 tests pass, build OK.
- Next: MOB-001

### Session 2026-03-21 (ADV-008)
- Task: ADV-008 — Social Trading Feed
- Result: Migration 025 (social_settings, social_posts, social_likes, social_comments + triggers + leaderboard SECURITY DEFINER fn). 5 API route groups under /api/portfolio/social. Page /portfolio/social: Feed tab (opt-in banner, create post form, post cards with like/comment, load-more) + Leaderboard tab (Net P&L/Win Rate/PF sort). Tab added to layout nav. 127 tests pass, build OK.
- Next: ADV-009

### Session 2026-03-21 (ADV-006)
- Task: ADV-006 — Multi-account portfolio view
- Result: New route /portfolio/multi-account. Server-side per-account KPI computation. Combined summary banner, P&L comparison bar chart, account card grid, comparison table. Tab added to layout nav.
- Next: ADV-007


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
### Session 2026-03-21 (continued 17)
- Task: QA-003 — QA Reports — compare with TradeZella reports
- Result: All 10 reports sub-tabs verified present and functional (Overview, Performance, Calendar, Symbols, Tags, Days, Day & Time, Risk, Recaps & Insights, Compare). Fixed: translated 80+ English strings to Thai across 4 files — analytics page (sub-tab labels, KPI card labels, table column headers, chart labels, empty states, tooltips, heatmap legends, compare tool labels, session/duration text), stats-overview (section titles, all 30+ stat labels), performance-metrics (metric dropdown labels), AnalyticsDashboard (risk metrics, day performance, lot/holding time headings), ConfigurableMetricChart (empty state). All checks pass: build OK, 127 tests pass.
- Next: QA-004
### Session 2026-03-21 (continued 18)
- Task: QA-004 — QA Day/Week View — compare with TradeZella
- Result: All 4 Day/Week View features verified present and functional (Day/Week toggle, calendar picker with profitable/losing day highlights, 7-day week cards with P&L, weekly summary stats with bar chart). Fixed: translated 40+ English strings to Thai across 3 files — day-view page (toggle labels, month names, day labels, stat labels, table headers, date/time locales en-US→th-TH, section headings, button text), day-view server (day names Sun/Mon→อาทิตย์/จันทร์), DayInsightsSection (heading, category labels). All checks pass: build OK, 127 tests pass.
- Next: QA-005
### Session 2026-03-21 (continued 19)
- Task: QA-005 — QA Settings pages
- Result: All 3 Settings tabs verified present and functional (Profile with editable name/avatar/MT5 account info/notification toggles, Security with password change/OAuth detection/active sessions/2FA coming soon badge/login provider info, Trade Settings with timezone selector/default TP-SL/per-symbol settings table/add-remove symbols). Fixed: translated 10+ English strings to Thai across 6 files — Profile page ("Push Notifications"→"การแจ้งเตือนผ่าน Push", aria-label), Security page ("Authenticator App"→"แอปยืนยันตัวตน"), Security API ("Invalid action"→"การกระทำไม่ถูกต้อง"), Trade API ("Timezone ไม่ถูกต้อง"→"โซนเวลาไม่ถูกต้อง"), all 3 APIs ("Unauthorized"→"ไม่ได้รับอนุญาต"). Removed 3 console.error statements from profile and trade APIs. Fixed type error for master_ibs broker name display. Improved trade settings mobile grid responsiveness (grid-cols-1 sm:grid-cols-2 md:grid-cols-5). All checks pass: build OK, 127 tests pass.
- Next: QA-006
### Session 2026-03-21 (continued 20)
- Task: QA-006 — QA Notebook, Playbook, Calendar, Trade Replay
- Result: All 4 feature areas verified present and functional (Notebook folders/search/rich text editor/Sessions Recap generation, Playbook templates marketplace browse/clone/publish with stats, Economic Calendar with events/filters/impact levels/week selector, Trade Replay with candlestick chart/transport controls/speed/P&L curve/entry-exit markers). Fixed: translated 70+ English strings to Thai across 6 files — Notebook page (folder labels, search placeholder, note list headers, editor toolbar, save status, empty states, date locale en-US→th-TH), TiptapEditor (9 toolbar tooltips: Bold→ตัวหนา, Italic→ตัวเอียง, etc.), Notebook API (5 error messages + session recap labels/title/stats text), Playbook page (tab labels, editor form labels, library section, performance table headers, template stats, clone/publish text), Calendar page (heading + title), Trade Replay page (status bar labels IN TRADE/CLOSED/PRE-ENTRY→Thai, transport control tooltips, jump buttons, keyboard hints, header labels Entry/Exit/Duration→Thai, Unrealized P/L label). All checks pass: build OK, 127 tests pass.
- Next: QA-007
### Session 2026-03-21 (continued 21)
- Task: QA-007 — QA Progress & Discipline
- Result: All 4 Progress & Discipline features verified present and functional (Daily Checklist with manual + 5 automated rules including trades_have_sl/journal_complete/max_loss_trade/max_loss_day/trades_linked_playbook, Progress Heatmap 12-week GitHub-style grid with completion rate colors, Streak counter tracking consecutive 100% completion days, Trade Insights engine with 18 trade-level rules + 5 day-level rules + quality score 0-100 with 8 weighted factors). Fixed: translated 50+ English strings to Thai across 10 files — Progress page (4 KPI card labels, 5 goal type descriptions, period/target labels), DailyChecklist (heading, manual/automated labels, add rule button/placeholder, status labels Pending→รอตรวจสอบ/Yes→ผ่าน/No→ไม่ผ่าน), ProgressHeatmap (heading, day labels Sun→อา, month labels Jan→ม.ค., streak label, legend Less/More→น้อย/มาก, tooltip), RulesAnalyticsTable (heading, 5 column headers), InsightsSection (heading, 4 category labels Positive→เชิงบวก), ScoreBreakdown (heading + 6 metric labels), QualityScoreBar (tooltip), checklist.ts (5 default rule names), rules-analytics.ts (3 condition format strings), checklist API (5 error messages), progress API (4 error messages). All checks pass: build OK, 127 tests pass.
- Next: QA-008
### Session 2026-03-21 (continued 22)
- Task: QA-008 — Full app QA — loading skeletons, empty states, mobile, English strings
- Result: Comprehensive audit of all 31 portfolio pages, 13 settings/admin/auth pages, and 49 components. Verified: loading skeletons present on Dashboard (OverviewSkeleton), Calendar (animated skeleton), Replay (loading skeleton block). Empty states present on all data-driven pages with Thai messages. No console.log found in production code (only legitimate console.error for server-side error logging). Mobile responsive with overflow-x-auto on tables, responsive grids (grid-cols-1/2/4), mobile card views. Fixed: translated 200+ English strings to Thai across 46 files — Journal page (24 labels: mood labels, KPI cards, form headings, dropdown options, section titles), Trades page (table headers 12 columns, Import/Export buttons, group labels), Trade Detail page (review step labels, tags heading, attachment options), Dashboard (Profit Factor→อัตราส่วนกำไร, Equity→มูลค่าพอร์ต), Analytics (3× Profit Factor), PortfolioFilterBar (15 filter labels/options: outcomes, sessions, directions, review status, duration, notes/attachments, saved views, buttons), MultiSelectDropdown (empty state), EquityChart (empty state), TradeReplayChart (reset tooltip), Live-trade (Bangkok Time→เวลากรุงเทพฯ), Admin dashboard (9 labels: heading, bridge status, online/offline, heartbeat, cycle, version), Admin client detail (8 KPI labels + 2 table headers + section headings), Admin approvals (MT5 validated tooltip), 21 portfolio API routes (Forbidden→ไม่ได้รับอนุญาต, Too many requests→คำขอมากเกินไป), 10 admin/IB API routes (Forbidden, Too many requests, Missing fields, Not found — all Thai). All checks pass: build OK, 127 tests pass.
- Next: POLISH-001
### Session 2026-03-21 (continued 23)
- Task: POLISH-001 — Audit components for missing loading skeletons
- Result: Audited all 14 portfolio pages and 49 components. Layout-level PortfolioSkeleton already covers all /portfolio/** navigation transitions. Dashboard has OverviewSkeleton. Calendar and Replay have inline loading states. Found 2 genuine gaps: (1) Notebook note list had `isSearching` state but showed stale results instead of skeleton — added 3 animated skeleton rows when searching. (2) MarketNewsFeed had no skeleton when `refreshing` with 0 articles — added 4 skeleton article rows, removed misleading "กำลังดึงข่าว..." text in favor of proper skeleton. All checks pass: build OK, 127 tests pass.
- Next: POLISH-002
### Session 2026-03-21 (continued 24)
- Task: POLISH-002 — Audit mobile responsiveness
- Result: Audited all portfolio pages, layouts, and components at 375px. Found 4 layout overflow issues: (1) Portfolio layout header had 5+ items in rigid `flex justify-between` row — fixed with `flex flex-col sm:flex-row sm:justify-between` to stack title/controls vertically on mobile. (2) Analytics sub-tabs lacked `flex-1 min-w-0` on the scrollable tabs container, preventing internal overflow-x scroll — fixed. (3) Recap period selector had 4 Thai-text buttons in `flex gap-1.5` without wrap — fixed with `flex-wrap`. (4) Journal date header with long Thai date + select dropdown lacked wrap — fixed with `flex-wrap`. Tables all have `overflow-x-auto`. Grids use responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` patterns. Notebook already has mobile toggle (hidden/flex by note selection). Settings uses mobile dropdown. All checks pass: build OK, 127 tests pass.
- Next: POLISH-003
### Session 2026-03-21 (continued 25)
- Task: POLISH-003 — Performance audit — lazy load charts
- Result: 4 changes for deferred chart initialization: (1) IntersectionObserver added to EquityChart, CumulativePnlChart, DailyPnlChart, ConfigurableMetricChart — lightweight-charts only initializes when chart container enters viewport (threshold 0.05), replacing immediate import() in onMount with observer-gated trigger. (2) Removed dead CumulativePnlChart import in analytics/+page.svelte (imported but never used in template). (3) ConfigurableMetricChart in analytics lazy-loaded via $effect — only fetched when user navigates to 'performance' tab, shows animated skeleton while loading. (4) TradeReplayChart in trade detail lazy-loaded via openReplay() async function — 426-line component not bundled with page, only fetched when user clicks Quick Replay button, shows Thai loading placeholder while importing. Build OK, 127 tests pass.
- Next: POLISH-004
### Session 2026-03-21 (continued 26)
- Task: POLISH-004 — Accessibility audit (ARIA, keyboard nav)
- Result: Audited all 51 interactive Svelte components and 8 route pages for ARIA gaps. Fixed 7 categories of issues: (1) MultiSelectDropdown — added aria-expanded, aria-haspopup="listbox" to trigger button, role="listbox"/role="option"/aria-selected to dropdown list. (2) StartMyDayModal — replaced incorrect role="button" backdrop with real <button>, added role="dialog"/aria-modal="true"/aria-labelledby to modal container, added id to h2. (3) AiChatPanel — replaced svelte-ignore backdrop div with proper <button>, added role="dialog"/aria-modal/aria-labelledby to panel, added aria-live="polite" to messages container. (4) TradeImportModal — replaced role="presentation" backdrop div with <button>, added role="dialog"/aria-modal/aria-labelledby/id to modal, aria-label="ปิด" to × button. (5) Portfolio layout tabs — changed <div> to role="tablist" aria-label="หน้าพอร์ต", added role="tab" aria-selected={isActive} to each tab link. (6) DailyChecklist — added role="progressbar" with aria-valuenow/min/max/label to progress bar, added role="checkbox" aria-checked aria-label to manual rule toggle buttons. (7) TradingCalendar — added aria-label with date+P&L to each day button, translated "Today"→"วันนี้"/"Month:"→"เดือนนี้"/"Days:"→"วัน:"/"Trades:"→"เทรด:"/"Total"→"รวม"/"Best"→"ดีที่สุด"/"Worst"→"แย่ที่สุด"/"Avg/Day"→"เฉลี่ย/วัน"/"Daily P&L"→"P&L รายวัน"/"Trades"→"เทรด"/"Win Rate"→"อัตราชนะ"/"Loss"→"ขาดทุน"/"Profit"→"กำไร", added aria-label="ขาย" legend, fixed close button aria-label to Thai. PortfolioFilterBar — added aria-expanded/aria-controls to toggle button, aria-label to search/date/select inputs. analytics/+page.svelte — added aria-label to calendar year prev/next buttons, added for/id to 4 unassociated label+select pairs in compare tool. day-view/+page.svelte — added aria-label to 4 icon-only navigation buttons (prev/next month/week). replay/+page.svelte — added aria-label/aria-expanded to mobile info toggle button. All a11y svelte-check warnings resolved, build OK, 127 tests pass.
- Next: POLISH-005
### Session 2026-03-22
- Task: FEAT-010 — Add visible Manual Sync Button on dashboard overview
- Result: Added Sync Status card to dashboard overview page in the AI Coach / Risk Calculator grid row (now 3-column on xl). Card shows: (1) Bridge status indicator with live/offline/unknown states and animated ping for online, (2) Last sync time using timeAgo(), (3) Auto-sync interval display (60s), (4) Prominent "Sync ตอนนี้" button with spinner animation during sync, cooldown state after sync, and disabled state. Handles 429 rate limit, network errors, and success feedback with auto-dismiss. Reuses existing /api/portfolio/sync-trigger API and invalidate('portfolio:baseData') pattern from layout. All Thai labels, dark theme consistent, mobile responsive (1→2→3 col grid). Also marked FEAT-001 through FEAT-009 and FEAT-012 as complete — all were already implemented in prior sessions but not marked in TASKS.md. Build OK, 127 tests pass.
- Files: src/routes/portfolio/+page.svelte, TASKS.md
- Next: FEAT-011

