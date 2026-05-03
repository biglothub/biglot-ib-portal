# IB Portal Gold Theme System Plan

วันที่อัปเดต: 4 พฤษภาคม 2026

เอกสารนี้เป็นแผนปรับ UI ทั้งเว็บให้เป็น **Gold Theme System** โดยแยกชัดระหว่าง:

- **Black/White Foundation**: โครง contrast, background, surface, border, text, table, form และ data density
- **Gold Brand Theme**: brand layer สำหรับ accent, active state, primary CTA, selected state, focus และ signal สำคัญ
- **Semantic State Layer**: success, warning, danger สำหรับ risk, approval, sync และ destructive actions

หลักคิดสำคัญ: งานนี้ไม่ใช่การเอาสีทองไปเติมใน dark UI เดิม แต่เป็นการจัดระบบ theme ให้ทั้งเว็บมี foundation ที่อ่านง่ายก่อน แล้วค่อยวางทองเป็น brand signal อย่างมีวินัย

Prototype HTML สำหรับทดลอง direction:

- `docs/pwa-prototypes/welcome.html`
- `docs/pwa-prototypes/dark-theme-app-prototype.html`

## Decision

เราจะใช้ **Gold Theme** เป็น theme หลักของ IB Portal แต่จะไม่ทำให้ทั้งเว็บกลายเป็นดำทองหนัก ๆ

Gold Theme หมายถึง:

- พื้นหลังและ surface ยังเป็น black/white foundation ที่อ่านง่าย
- สีทองเป็น brand layer ที่ใช้จำกัด
- ตาราง, chart, dashboard และ form ยังต้องสงบและ scan ง่าย
- Gold theme เป็นค่าเริ่มต้น แต่ `dark`, `light`, และ `system` ยังต้องใช้งานได้ครบ

Gold Theme ไม่หมายถึง:

- ใช้ทองกับทุก heading
- ใช้ทองเป็น border ทุก card
- ใช้ glow ทั่วหน้า
- ทำ dashboard ให้เหมือน landing page
- เปลี่ยน semantic color เช่น profit/loss ให้เป็นทอง

## Product Direction

Tone: refined trading terminal

- ใช้งานทุกวันได้โดยไม่ล้าตา
- พรีเมียมแบบนิ่ง ไม่หรูปลอม
- ข้อมูลการเทรดมาก่อน decoration
- Mobile PWA และ desktop dashboard ต้องรู้สึกเป็น product เดียวกัน
- หน้า admin/IB ต้อง dense และ operational กว่าหน้า client

Core references:

- `docs/pwa-prototypes/welcome.html`: warm dark, ivory text, gold accent, restrained motion
- `/Users/iphone/Desktop/open-design/craft/color.md`: accent discipline, contrast gates, dark theme rules
- `/Users/iphone/Desktop/open-design/craft/typography.md`: type scale, line height, tracking discipline

## Repo Structure Impact

### Framework And Theme Entrypoints

| Path | Role | Theme impact |
| --- | --- | --- |
| `src/app.css` | Global Tailwind entry + CSS variables + shared classes | Primary source of tokens and component classes |
| `tailwind.config.ts` | Tailwind aliases | Must map `dark`, `brand`, semantic colors to CSS tokens |
| `src/app.html` | HTML shell + early theme script | Remove localStorage theme lookup and prevent light flash |
| `src/routes/+layout.svelte` | Authenticated app shell | Keep `ThemeToggle`, apply shell foundation |
| `src/lib/stores/theme.svelte.ts` | Theme state store | Add `gold` default while preserving `dark`, `light`, `system` |
| `src/lib/components/layout/ThemeToggle.svelte` | Theme picker | Add Gold option as the first/default choice |

### Route Groups

| Route group | Files | Priority | Notes |
| --- | --- | --- | --- |
| Auth/welcome/offline | `src/routes/welcome`, `src/routes/auth`, `src/routes/offline` | P1 | First impression and PWA fallback |
| Portfolio shell | `src/routes/portfolio/+layout.svelte` | P1 | Header, tabs, sync, mobile nav, shortcuts |
| Portfolio overview | `src/routes/portfolio/+page.svelte` | P1 | Main client dashboard |
| Portfolio workflows | `trades`, `journal`, `day-view`, `live-trade`, `calendar` | P2 | High interaction density |
| Analytics/reporting | `analytics`, `analysis`, reports components | P2 | Tables/charts need careful contrast |
| AI/TradePilot | `portfolio/ai`, `src/lib/components/portfolio/tradepilot/**` | P2 | Message surfaces and tool output |
| Settings | `src/routes/settings/**` | P2 | Forms, toggles, QR, notification preferences |
| IB | `src/routes/ib/**` | P3 | Client submission workflow |
| Admin | `src/routes/admin/**` | P3 | Dense operational tables/actions |
| API routes | `src/routes/api/**` | P4 | No visual refactor except UI state labels fed by APIs |

### Component Groups

| Component group | Path | Theme responsibility |
| --- | --- | --- |
| Layout | `src/lib/components/layout/**` | sidebar, mobile nav, notification bell, install/push prompts |
| PWA | `src/lib/components/pwa/**` | bottom sheet, mobile header, pull-to-refresh, sync center |
| Shared | `src/lib/components/shared/**` | reusable system primitives: badges, empty states, metric cards, command palette, toasts |
| Portfolio | `src/lib/components/portfolio/**` | dashboard cards, AI chat, filters, trade cards, modals, editors, calculators |
| TradePilot | `src/lib/components/portfolio/tradepilot/**` | AI assistant layout and message states |
| Analytics | `src/lib/components/analytics/**` | analytics tab surfaces and tables |
| Charts | `src/lib/components/charts/**` | chart backgrounds, grid, tooltips, positive/negative colors |
| Reports | `src/lib/components/reports/**` | report tables and stats overview |

## Theme Architecture

### Layer 1 - Black/White Foundation

Purpose: readable structure for every screen.

Use for:

- page background
- app shell
- cards/panels/tables/forms
- default text
- muted text
- borders
- hover states
- skeleton/loading surfaces

Do not mix this layer with role-specific meaning. Foundation color should not imply success, warning, danger or selection by itself.

Suggested tokens:

```css
:root {
  color-scheme: dark;

  --c-bg: #0a0a0a;
  --c-bg-rgb: 10 10 10;
  --c-bg-elevated: #11100e;
  --c-surface: #1a1815;
  --c-surface-rgb: 26 24 21;
  --c-surface-2: #221f1a;
  --c-surface-3: #2a251d;
  --c-hover: #262219;

  --c-text-primary: #f5f1e3;
  --c-text-strong: #fffaf0;
  --c-text-secondary: #b8ad94;
  --c-text-muted: #8a8578;

  --c-border: rgba(245, 241, 227, 0.08);
  --c-border-strong: rgba(245, 241, 227, 0.14);
}
```

### Layer 2 - Gold Brand Theme

Purpose: brand, selection and primary action.

Use for:

- primary CTA
- active sidebar item
- active tab
- selected filter chip
- important brand badge
- focus ring
- brand mark
- one meaningful highlight per screen

Do not use for:

- every heading
- normal body text
- every border
- table row decoration
- all chart lines
- profit/loss semantic state

Suggested tokens:

```css
:root {
  --c-brand: #c9a84c;
  --c-brand-soft: #d4af37;
  --c-brand-deep: #8b7635;
  --c-brand-contrast: #1a1815;
  --c-brand-bg: rgba(201, 168, 76, 0.12);
  --c-brand-bg-strong: rgba(201, 168, 76, 0.18);
  --c-brand-border: rgba(201, 168, 76, 0.24);
  --c-brand-ring: rgba(201, 168, 76, 0.32);
}
```

Gold usage budget:

- App shell: brand mark + active nav
- Dashboard: primary CTA + one active state
- Table-heavy pages: selected tab/filter only
- Settings: save button + active settings nav
- Admin/IB: selected tab/filter; approve/reject remain semantic
- Mobile: active bottom tab + primary FAB/CTA

### Layer 3 - Semantic State

Purpose: state meaning independent of brand.

```css
:root {
  --c-success: #22c55e;
  --c-success-bg: rgba(34, 197, 94, 0.12);
  --c-success-border: rgba(34, 197, 94, 0.24);

  --c-warning: #f59e0b;
  --c-warning-bg: rgba(245, 158, 11, 0.12);
  --c-warning-border: rgba(245, 158, 11, 0.26);

  --c-danger: #ef4444;
  --c-danger-bg: rgba(239, 68, 68, 0.12);
  --c-danger-border: rgba(239, 68, 68, 0.24);
}
```

Rules:

- Profit/loss uses success/danger, not gold
- Approval/reject uses success/danger
- Sync online uses success
- Sync pending/rate-limit uses warning
- Destructive actions use danger

### Layer 4 - Data Visualization

Purpose: charts and dense analytics.

Suggested mapping:

- Equity primary line: brand gold only when it is the main chart
- Secondary chart lines: muted ivory, semantic green/red, or stable data palette
- Grid: `--c-border`
- Tooltip: `--c-surface-2`
- Crosshair/axis: `--c-text-muted`
- Positive bars: success
- Negative bars: danger
- Neutral bars: muted surface/ivory alpha

## Tailwind Mapping

Keep existing Tailwind utility names where possible to reduce migration blast radius:

| Existing utility | New meaning |
| --- | --- |
| `bg-dark-bg` | `rgb(var(--c-bg-rgb) / <alpha-value>)` |
| `bg-dark-surface` | `rgb(var(--c-surface-rgb) / <alpha-value>)` |
| `bg-dark-hover` | tokenized hover surface |
| `border-dark-border` | `--c-border` |
| `text-white` | migrate away gradually; prefer token/shared classes |
| `brand-primary` | `--c-brand` |
| `brand-600` | darker gold for hover/pressed |

Add semantic aliases only when they remove repeated class noise:

- `text-app`
- `text-app-strong`
- `text-app-muted`
- `bg-app-panel`
- `border-app`
- `bg-brand-soft`

Do not add too many theme utilities before seeing repeated use. Start with CSS variables and shared component classes.

## Shared UI Primitives

These should live in `src/app.css` first. Extract Svelte components only if repeated markup is large.

### Buttons

Classes:

- `.btn-primary`
- `.btn-secondary`
- `.btn-ghost`
- `.btn-danger`
- `.btn-success`
- `.icon-button`

Tasks:

- [ ] Primary uses gold fill and dark contrast text
- [ ] Secondary uses surface/border and ivory text
- [ ] Ghost uses transparent background and clear hover
- [ ] Danger/success are semantic, not gold
- [ ] Focus ring uses brand ring unless semantic action needs semantic focus
- [ ] Disabled state remains readable and non-clickable

### Panels And Cards

Classes:

- `.panel`
- `.card`
- `.metric-card`
- `.table-shell`
- `.modal-panel`
- `.bottom-sheet-panel`

Tasks:

- [ ] Use warm surface token
- [ ] Use ivory-alpha border
- [ ] Avoid nested card styling
- [ ] Stabilize KPI heights
- [ ] Add overflow handling for Thai labels and long emails

### Badges And Chips

Classes:

- `.badge`
- `.badge-brand`
- `.badge-success`
- `.badge-warning`
- `.badge-danger`
- `.filter-chip`
- `.tab-pill`

Tasks:

- [ ] Brand badge only for selected/active/important brand signal
- [ ] Status badges use semantic colors
- [ ] Chips remain readable at 11-13px
- [ ] Icons/dots are not color-only state indicators

### Forms

Classes:

- `.input`
- `.select`
- `.textarea`
- `.label`
- `.help-text`
- `.error-text`
- `.toggle`

Tasks:

- [ ] All controls use foundation surface and border
- [ ] Focus ring is visible on keyboard navigation
- [ ] Error state includes text
- [ ] Toggle thumb can remain light if it improves affordance
- [ ] QR code white panel remains intentional exception

### Tables

Classes:

- `.data-table`
- `.th-label`
- `.row-hover`
- `.numeric`
- `.empty-table`

Tasks:

- [ ] Header text uses muted warm text
- [ ] Row hover uses hover token
- [ ] Borders use foundation border
- [ ] Numeric cells use tabular figures
- [ ] Dense admin tables remain compact

### Overlays

Classes/components:

- `CommandPalette.svelte`
- `ShortcutsHelp.svelte`
- `BottomSheet.svelte`
- `InstallPrompt.svelte`
- `SyncCenter.svelte`
- `SaveToast.svelte`
- `UndoToast.svelte`
- `NetworkStatus.svelte`

Tasks:

- [ ] Overlay background and shadow align with panel tokens
- [ ] Backdrop opacity works on warm dark background
- [ ] Toasts do not look like detached light elements
- [ ] Bottom sheets respect mobile safe-area

## Detailed Implementation Plan

## Phase 0 - Full Baseline Audit

Goal: understand current UI debt before touching theme behavior.

Commands:

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] `rg -n "ThemeToggle|theme\\.svelte|ib-portal-theme|:root:not\\(\\.dark\\)|color-scheme: light" src`
- [ ] `rg -n "text-white|text-gray-|bg-white|border-white|border-gray-|bg-gray-" src/routes src/lib/components`
- [ ] `rg --files src/routes | rg "\\+page\\.svelte$|\\+layout\\.svelte$"`
- [ ] `rg --files src/lib/components`

Screenshots:

- [ ] Desktop 1440x900: `/portfolio`
- [ ] Desktop 1440x900: `/portfolio/trades`
- [ ] Desktop 1440x900: `/portfolio/analytics`
- [ ] Desktop 1440x900: `/settings`
- [ ] Desktop 1440x900: `/ib`
- [ ] Desktop 1440x900: `/admin`
- [ ] Mobile 390x844: `/welcome`
- [ ] Mobile 390x844: `/auth/login`
- [ ] Mobile 390x844: `/portfolio`
- [ ] Mobile 390x844: `/portfolio/trades`
- [ ] Mobile 390x844: `/settings`

Acceptance criteria:

- [ ] Baseline check/build status recorded
- [ ] Hardcoded class hotspots known
- [ ] Auth/data limitations for screenshot routes documented

## Phase 1 - Gold Theme Default And Platform Wiring

Goal: make Gold the default theme while preserving dark/light/system behavior.

Files:

- `src/app.css`
- `tailwind.config.ts`
- `src/app.html`
- `src/routes/+layout.svelte`
- `src/lib/stores/theme.svelte.ts`
- `src/lib/components/layout/ThemeToggle.svelte`
- `src/routes/settings/+page.svelte`

Tasks:

- [ ] Rename mental model from dark theme to Gold Theme in comments/docs
- [ ] Replace `:root` light token block with dark foundation + gold brand tokens
- [ ] Remove `:root:not(.dark)` light overrides
- [ ] Keep `.dark` class only as compatibility if needed, not as behavior switch
- [ ] Set `color-scheme: dark`
- [ ] Update `meta[name="theme-color"]` to foundation background
- [ ] Keep `ThemeToggle` in root layout header
- [ ] Add `gold` to `ThemeMode`
- [ ] Make `gold` the default when `ib-portal-theme` is missing or invalid
- [ ] Preserve existing `dark`, `light`, and `system` choices
- [ ] Update early script to apply `gold`, `dark`, or `light` class before hydration
- [ ] Keep `system` resolving from `prefers-color-scheme`
- [ ] Add Gold option to settings theme UI
- [ ] Keep `ib-portal-theme` localStorage as the user preference key

Acceptance criteria:

- [ ] New users land on Gold theme by default
- [ ] Existing dark/light/system preferences still work
- [ ] System preference can switch between dark/light when user selected system
- [ ] Reload has no light flash
- [ ] Theme picker includes Gold, dark, light, and system
- [ ] Intentional theme comments refer to Gold Theme system

## Phase 2 - Token And Primitive Migration

Goal: shared classes carry most visual change before page-by-page edits.

Files:

- `src/app.css`
- `tailwind.config.ts`
- `src/lib/components/shared/MetricCard.svelte`
- `src/lib/components/shared/StatusBadge.svelte`
- `src/lib/components/shared/TagPill.svelte`
- `src/lib/components/shared/EmptyState.svelte`
- `src/lib/components/shared/MultiSelectDropdown.svelte`
- `src/lib/components/shared/RangeInput.svelte`
- `src/lib/components/reports/StatsOverviewTable.svelte`

Tasks:

- [ ] Add foundation, brand, semantic and chart tokens
- [ ] Update existing `.btn-*`, `.card`, `.input`, `.label`, `.th-label`, `.metric-*`
- [ ] Add `.btn-ghost`, `.panel`, `.table-shell`, `.badge-*`, `.tab-pill` if useful
- [ ] Update shared `MetricCard` to use token classes
- [ ] Update shared `StatusBadge` to separate brand vs semantic states
- [ ] Update `TagPill` and dropdown surfaces
- [ ] Update shared empty states to use muted text and minimal brand accent
- [ ] Update report stats table

Acceptance criteria:

- [ ] Shared components no longer depend on ad hoc gray/white classes
- [ ] Route pages using shared primitives improve without local edits
- [ ] Gold is visible but not overused in primitive defaults

## Phase 3 - App Shell And Global Layout

Goal: make authenticated shell coherent across all roles.

Files:

- `src/routes/+layout.svelte`
- `src/lib/components/layout/Sidebar.svelte`
- `src/lib/components/layout/SidebarNews.svelte`
- `src/lib/components/layout/NotificationBell.svelte`
- `src/lib/components/layout/MobileNav.svelte`
- `src/lib/components/layout/InstallPrompt.svelte`
- `src/lib/components/layout/PushPermission.svelte`
- `src/lib/components/layout/UpdateNotification.svelte`
- `src/lib/components/pwa/MobileHeader.svelte`
- `src/lib/components/pwa/BottomSheet.svelte`
- `src/lib/components/pwa/IOSInstallSteps.svelte`
- `src/lib/components/pwa/PullToRefresh.svelte`
- `src/lib/components/pwa/SyncCenter.svelte`
- `src/lib/components/shared/NetworkStatus.svelte`
- `src/lib/components/shared/CommandPalette.svelte`
- `src/lib/components/shared/ShortcutsHelp.svelte`
- `src/lib/components/shared/SaveToast.svelte`
- `src/lib/components/shared/UndoToast.svelte`

Tasks:

- [ ] Root shell uses foundation background
- [ ] Sidebar surface and borders use foundation tokens
- [ ] Sidebar active state uses brand gold
- [ ] Sidebar hover state stays neutral, not gold
- [ ] SidebarNews card uses panel styling
- [ ] Notification bell badge uses semantic/brand only when meaningful
- [ ] MobileNav active state uses brand with clear label/icon state
- [ ] MobileHeader uses safe-area aware foundation surface
- [ ] Install/push prompts use bottom sheet panel tokens
- [ ] Network/offline/reconnect states use semantic colors
- [ ] Command palette and shortcuts modal use overlay panel tokens
- [ ] Toasts use foundation panel and semantic side state only when needed

Acceptance criteria:

- [ ] App shell looks consistent before route content loads
- [ ] Role changes do not change theme language
- [ ] Mobile overlays do not collide with safe areas
- [ ] No gold hover flood in nav/sidebar

## Phase 4 - Welcome, Auth And Offline

Goal: first impression matches Gold Theme and remains mobile-first.

Files:

- `src/routes/welcome/+page.svelte`
- `src/routes/auth/login/+page.svelte`
- `src/routes/auth/mfa/+page.svelte`
- `src/routes/offline/+page.svelte`

Tasks:

- [ ] Keep `/welcome` close to `docs/pwa-prototypes/welcome.html`
- [ ] Replace local hardcoded colors with tokens where practical
- [ ] Preserve mobile-only redirect behavior
- [ ] Login page uses foundation panel and brand CTA
- [ ] Google button remains intentionally white as provider control
- [ ] MFA page uses same form primitives
- [ ] Offline page distinguishes offline/cached/retry states with semantic colors

Acceptance criteria:

- [ ] `/welcome` and `/auth/login` feel like same product
- [ ] Provider white button is the only large white surface in auth
- [ ] Offline page is readable on mobile and desktop

## Phase 5 - Portfolio Shell And Overview

Goal: main client workspace becomes the reference implementation for product UI.

Files:

- `src/routes/portfolio/+layout.svelte`
- `src/routes/portfolio/+page.svelte`
- `src/lib/components/portfolio/AccountSwitcher.svelte`
- `src/lib/components/portfolio/SyncStatusBadge.svelte`
- `src/lib/components/portfolio/OverviewSkeleton.svelte`
- `src/lib/components/portfolio/PortfolioSkeleton.svelte`
- `src/lib/components/portfolio/PortfolioGuide.svelte`
- `src/lib/components/portfolio/DashboardCustomizer.svelte`
- `src/lib/components/portfolio/HealthScoreCard.svelte`
- `src/lib/components/portfolio/MonthlyGoalCard.svelte`
- `src/lib/components/portfolio/ExecutionMetricsCard.svelte`
- `src/lib/components/portfolio/BestWorstCard.svelte`
- `src/lib/components/portfolio/RecentRhythmCard.svelte`
- `src/lib/components/portfolio/InsightsSection.svelte`
- `src/lib/components/portfolio/DayInsightsSection.svelte`
- `src/lib/components/portfolio/MarketNewsFeed.svelte`
- `src/lib/components/portfolio/MiniCalendar.svelte`

Tasks:

- [ ] Portfolio header uses foundation text and restrained action cluster
- [ ] Active tab uses brand; inactive tabs remain neutral
- [ ] Sync button/failure/cooldown use semantic colors
- [ ] Account switcher dropdown uses overlay panel
- [ ] Dashboard KPI cards use stable metric style
- [ ] Skeletons use foundation surfaces
- [ ] Guide modal uses overlay tokens
- [ ] News and insight cards avoid nested-card feel
- [ ] Calendar mini states use semantic/brand mapping carefully

Acceptance criteria:

- [ ] `/portfolio` is the canonical Gold Theme screen
- [ ] Dashboard is dense but not visually noisy
- [ ] Gold appears only on active/primary/brand signals
- [ ] 375px mobile has no horizontal overflow

## Phase 6 - Trades, Journal And Day Workflows

Goal: high-interaction client workflows use consistent forms, tables and cards.

Files:

- `src/routes/portfolio/trades/+page.svelte`
- `src/routes/portfolio/trades/[id]/+page.svelte`
- `src/routes/portfolio/trades/[id]/replay/+page.svelte`
- `src/routes/portfolio/journal/+page.svelte`
- `src/routes/portfolio/day-view/+page.svelte`
- `src/routes/portfolio/live-trade/+page.svelte`
- `src/routes/portfolio/calendar/+page.svelte`
- `src/lib/components/portfolio/ActiveFilterChips.svelte`
- `src/lib/components/portfolio/PortfolioFilterBar.svelte`
- `src/lib/components/portfolio/SwipeableTradeCard.svelte`
- `src/lib/components/portfolio/TradeKpiHeader.svelte`
- `src/lib/components/portfolio/TradeProfitBadge.svelte`
- `src/lib/components/portfolio/ReviewStatusBadge.svelte`
- `src/lib/components/portfolio/TradeComparePanel.svelte`
- `src/lib/components/portfolio/TradeContextChart.svelte`
- `src/lib/components/portfolio/TradeReplayChart.svelte`
- `src/lib/components/portfolio/TradeImportModal.svelte`
- `src/lib/components/portfolio/QuickTradeEntry.svelte`
- `src/lib/components/portfolio/DayFeedCard.svelte`
- `src/lib/components/portfolio/DayNoteModal.svelte`
- `src/lib/components/portfolio/DailyChecklist.svelte`
- `src/lib/components/portfolio/ChecklistEditor.svelte`
- `src/lib/components/portfolio/EndOfDayWizard.svelte`
- `src/lib/components/portfolio/StartMyDayModal.svelte`
- `src/lib/components/portfolio/TradingCalendar.svelte`

Tasks:

- [ ] Trades table/list uses table-shell and semantic P&L colors
- [ ] Filter chips use brand only for selected filters
- [ ] Trade cards use foundation panel and status badges
- [ ] Trade detail panels avoid nested cards
- [ ] Replay chart surfaces match chart tokens
- [ ] Journal editor, checklist and note modals use form primitives
- [ ] Quick trade entry uses compact form hierarchy
- [ ] Swipeable mobile cards keep action colors semantic
- [ ] Day view feed uses neutral surfaces and semantic state badges
- [ ] Live trade scan uses semantic live/risk signals, not gold everywhere

Acceptance criteria:

- [ ] Trades workflow is readable on desktop and mobile
- [ ] Profit/loss remains green/red, never gold
- [ ] Modal and bottom-sheet surfaces match app shell

## Phase 7 - Analytics, Reports And Charts

Goal: chart-heavy and table-heavy UI remains accurate and accessible.

Files:

- `src/routes/portfolio/analytics/+page.svelte`
- `src/routes/portfolio/analysis/+page.svelte`
- `src/lib/components/analytics/OverviewTab.svelte`
- `src/lib/components/analytics/PerformanceTab.svelte`
- `src/lib/components/analytics/RiskTab.svelte`
- `src/lib/components/analytics/SymbolsTab.svelte`
- `src/lib/components/analytics/TagsTab.svelte`
- `src/lib/components/analytics/DaysTab.svelte`
- `src/lib/components/analytics/DaytimeTab.svelte`
- `src/lib/components/analytics/CalendarTab.svelte`
- `src/lib/components/analytics/CompareTab.svelte`
- `src/lib/components/analytics/CorrelationTab.svelte`
- `src/lib/components/analytics/RecapsTab.svelte`
- `src/lib/components/charts/ConfigurableMetricChart.svelte`
- `src/lib/components/charts/CumulativePnlChart.svelte`
- `src/lib/components/charts/DailyPnlChart.svelte`
- `src/lib/components/charts/DayMiniPnlChart.svelte`
- `src/lib/components/charts/DaySparkline.svelte`
- `src/lib/components/charts/DrawdownChart.svelte`
- `src/lib/components/charts/EquityChart.svelte`
- `src/lib/components/charts/MultiTimeframeChart.svelte`
- `src/lib/components/charts/TradeDurationChart.svelte`
- `src/lib/components/charts/TradeTimeChart.svelte`
- `src/lib/components/charts/TradingScoreRadar.svelte`
- `src/lib/components/reports/StatsOverviewTable.svelte`

Tasks:

- [ ] Analytics tab bar uses brand for active tab only
- [ ] Export menus and saved views use overlay tokens
- [ ] Tables use shared table styles
- [ ] Chart backgrounds match panel/foundation
- [ ] Chart grid lines use ivory alpha border
- [ ] Tooltips use dark panel and readable text
- [ ] Equity primary line may use gold only when it is the hero data series
- [ ] Drawdown, loss and risk charts keep semantic danger/warning colors
- [ ] Correlation/compare views use stable non-brand data palette
- [ ] Radar chart marker exceptions documented if white markers remain

Acceptance criteria:

- [ ] Charts are readable and not over-branded
- [ ] Analytics route does not look like a separate design system
- [ ] Data meaning is not confused with brand gold

## Phase 8 - AI, TradePilot And Advanced Portfolio Tools

Goal: AI surfaces feel integrated and operational, not chat-demo styled.

Files:

- `src/routes/portfolio/ai/+page.svelte`
- `src/routes/portfolio/playbook/+page.svelte`
- `src/routes/portfolio/progress/+page.svelte`
- `src/lib/components/portfolio/AiChatButton.svelte`
- `src/lib/components/portfolio/AiChatPanel.svelte`
- `src/lib/components/portfolio/AiChatMessage.svelte`
- `src/lib/components/portfolio/AiCoachCard.svelte`
- `src/lib/components/portfolio/InsightBadge.svelte`
- `src/lib/components/portfolio/JournalTemplates.svelte`
- `src/lib/components/portfolio/RiskCalculator.svelte`
- `src/lib/components/portfolio/RiskOfRuinGauge.svelte`
- `src/lib/components/portfolio/RulesAnalyticsTable.svelte`
- `src/lib/components/portfolio/ScoreBreakdown.svelte`
- `src/lib/components/portfolio/ScreenshotAnnotator.svelte`
- `src/lib/components/portfolio/TagManager.svelte`
- `src/lib/components/portfolio/TiptapEditor.svelte`
- `src/lib/components/portfolio/ActivityHeatmap.svelte`
- `src/lib/components/portfolio/ProgressHeatmap.svelte`
- `src/lib/components/portfolio/QualityScoreBar.svelte`
- `src/lib/components/portfolio/tradepilot/TradePilotComposer.svelte`
- `src/lib/components/portfolio/tradepilot/TradePilotEmptyState.svelte`
- `src/lib/components/portfolio/tradepilot/TradePilotMessageRow.svelte`
- `src/lib/components/portfolio/tradepilot/TradePilotSidebar.svelte`

Tasks:

- [ ] AI FAB uses brand gold as one of the few global brand actions
- [ ] Chat panel surface matches overlay/panel tokens
- [ ] User/assistant messages are differentiated by structure, not random colors
- [ ] Tool result panels use table/panel primitives
- [ ] Composer focus ring uses brand
- [ ] Empty states are useful and compact
- [ ] Playbook/progress cards use foundation panels
- [ ] Heatmap empty cells use neutral alpha, not bright gray
- [ ] Risk calculator semantic outputs use success/warning/danger
- [ ] Tiptap editor content area uses form/editor tokens

Acceptance criteria:

- [ ] AI pages feel native to IB Portal
- [ ] Gold is not used to imply AI magic everywhere
- [ ] Advanced tools remain readable and dense

## Phase 9 - Settings

Goal: make all account/preference/security forms consistent.

Files:

- `src/routes/settings/+layout.svelte`
- `src/routes/settings/+page.svelte`
- `src/routes/settings/security/+page.svelte`
- `src/routes/settings/trade/+page.svelte`
- `src/routes/settings/alerts/+page.svelte`
- `src/routes/settings/email-reports/+page.svelte`

Tasks:

- [ ] Settings layout side nav active state uses brand
- [ ] Mobile settings selector uses panel/dropdown tokens
- [ ] Update theme preference section to include Gold as default
- [ ] Profile cards use foundation panel
- [ ] Inputs/selects/textareas use form primitives
- [ ] Toggles use foundation track, brand active track, light thumb exception if needed
- [ ] Security QR panel remains white only around QR code
- [ ] Alert threshold inputs and alert cards use form/panel primitives
- [ ] Email report schedules use consistent toggles and chips
- [ ] Webhook/API sections use code-like surfaces only where necessary

Acceptance criteria:

- [ ] Settings has no theme mode UI
- [ ] Long Thai labels and emails do not overflow
- [ ] QR remains scannable
- [ ] Every form state has clear focus/error/disabled styling

## Phase 10 - IB Workflow

Goal: Master IB routes follow the same operational UI language.

Files:

- `src/routes/ib/+page.svelte`
- `src/routes/ib/clients/+page.svelte`
- `src/routes/ib/clients/[id]/+page.svelte`
- `src/routes/ib/clients/add/+page.svelte`

Tasks:

- [ ] IB dashboard KPIs use metric-card
- [ ] Client list uses table/card pattern depending on viewport
- [ ] Add client form uses form primitives
- [ ] MT5 credential validation states use semantic badges
- [ ] Pending/resubmitted/rejected/approved/suspended statuses use semantic mapping
- [ ] Edit/resubmit/cancel buttons use action hierarchy
- [ ] Empty clients state explains next action without marketing layout

Acceptance criteria:

- [ ] IB workflow is visually consistent with settings/admin
- [ ] Status meaning does not depend only on color
- [ ] Gold is limited to primary add/active navigation

## Phase 11 - Admin Workflow

Goal: admin pages become dense, controlled and consistent.

Files:

- `src/routes/admin/+page.svelte`
- `src/routes/admin/approvals/+page.svelte`
- `src/routes/admin/clients/+page.svelte`
- `src/routes/admin/clients/[id]/+page.svelte`
- `src/routes/admin/coaches/+page.svelte`
- `src/routes/admin/ibs/+page.svelte`
- `src/routes/admin/ibs/[id]/+page.svelte`

Tasks:

- [ ] Admin dashboard metrics use metric-card
- [ ] Approval tabs use brand active state
- [ ] Approval cards/actions use semantic approve/reject buttons
- [ ] Clients table filters use filter chips/dropdowns
- [ ] Client detail panels use foundation panels
- [ ] Admin view banner uses warning style, not brand style
- [ ] Coaches forms/lists use form/table primitives
- [ ] IB list/detail pages use table/panel primitives
- [ ] Destructive actions are danger, never gold

Acceptance criteria:

- [ ] Admin pages are scan-friendly and compact
- [ ] Operational risk is visually clear
- [ ] No decorative gold overload in admin tables

## Phase 12 - Final Cleanup And Regression

Goal: remove old theme debt and lock quality.

Tasks:

- [ ] Keep `src/lib/components/layout/ThemeToggle.svelte` and verify Gold option
- [ ] Keep `src/lib/stores/theme.svelte.ts` and verify `gold | dark | light | system`
- [ ] Remove stale light-mode comments from `src/app.css`
- [ ] Remove unused Tailwind aliases
- [ ] Run `rg -n ":root:not\\(\\.dark\\)|color-scheme: light" src`
- [ ] Run `rg -n "ThemeMode|ib-portal-theme|ThemeToggle|gold|system" src`
- [ ] Audit remaining `text-white`, `bg-white`, `border-white`, `text-gray-*`, `border-gray-*`
- [ ] Document intentional exceptions
- [ ] Run `npm run check`
- [ ] Run `npm run build`
- [ ] Run focused tests for touched API/UI workflows if affected
- [ ] Capture final screenshot matrix

Acceptance criteria:

- [ ] Gold is default and live dark/light/system behavior remains
- [ ] Intentional white/light elements are documented
- [ ] Check/build pass or unrelated failures are documented
- [ ] Gold Theme is coherent across all route groups

## Intentional Exceptions

These light/white uses can remain if reviewed:

- Google sign-in button in `src/routes/auth/login/+page.svelte`
- QR code container in `src/routes/settings/security/+page.svelte`
- Toggle thumbs where light thumb improves affordance
- Small chart markers where contrast requires it
- Provider logos/assets that must keep original colors

Any other white panel/background should be treated as a migration bug.

## QA Matrix

### Viewports

- [ ] 375 x 812
- [ ] 390 x 844
- [ ] 430 x 932
- [ ] 768 x 1024
- [ ] 1440 x 900
- [ ] 1728 x 1117

### Core Routes

- [ ] `/welcome`
- [ ] `/auth/login`
- [ ] `/auth/mfa`
- [ ] `/offline`
- [ ] `/portfolio`
- [ ] `/portfolio/trades`
- [ ] `/portfolio/trades/[id]`
- [ ] `/portfolio/trades/[id]/replay`
- [ ] `/portfolio/journal`
- [ ] `/portfolio/day-view`
- [ ] `/portfolio/analytics`
- [ ] `/portfolio/ai`
- [ ] `/portfolio/playbook`
- [ ] `/portfolio/progress`
- [ ] `/portfolio/calendar`
- [ ] `/portfolio/live-trade`
- [ ] `/portfolio/analysis`
- [ ] `/settings`
- [ ] `/settings/security`
- [ ] `/settings/trade`
- [ ] `/settings/alerts`
- [ ] `/settings/email-reports`
- [ ] `/ib`
- [ ] `/ib/clients`
- [ ] `/ib/clients/[id]`
- [ ] `/ib/clients/add`
- [ ] `/admin`
- [ ] `/admin/approvals`
- [ ] `/admin/clients`
- [ ] `/admin/clients/[id]`
- [ ] `/admin/coaches`
- [ ] `/admin/ibs`
- [ ] `/admin/ibs/[id]`

### Visual Checks

- [ ] No light flash on reload
- [ ] No accidental white/light panels
- [ ] Body text contrast passes AA
- [ ] Table text, headers and row hover are readable
- [ ] Gold appears restrained and intentional
- [ ] Profit/loss and destructive states keep semantic color
- [ ] Buttons have clear hierarchy
- [ ] Focus states visible
- [ ] Modals/bottom sheets/toasts share overlay styling
- [ ] Mobile touch targets are at least 44px where practical
- [ ] Thai text wraps cleanly
- [ ] No horizontal overflow on mobile
- [ ] Charts have readable axes/tooltips/grid lines

## Suggested PR Sequence

1. **Plan + prototype**: keep docs/prototype current
2. **Theme default wiring**: tokens, app.html, theme store, theme picker
3. **Shared primitives**: app.css, Tailwind aliases, shared components
4. **Global shell**: sidebar, topbar, mobile nav, PWA overlays
5. **Auth/welcome/offline**
6. **Portfolio overview**
7. **Trades/journal/day workflows**
8. **Analytics/charts/reports**
9. **AI/TradePilot/advanced tools**
10. **Settings**
11. **IB**
12. **Admin**
13. **Cleanup + full QA**

Each PR should include:

- [ ] Scope summary
- [ ] Files touched
- [ ] Screenshots before/after when UI visible
- [ ] `npm run check` result
- [ ] `npm run build` result when platform/shared code changes
- [ ] Remaining exceptions or follow-up tasks

## Definition Of Done

- Gold Theme is defined as a brand layer over black/white foundation
- Gold is the default theme by behavior
- Dark, light, and system theme choices still work
- Theme preference remains persisted in localStorage
- Shared tokens/classes carry most visual decisions
- Route-level styling handles layout-specific needs only
- Portfolio, settings, IB and admin use the same foundations
- Charts and tables remain readable
- Mobile PWA remains safe-area aware and touch-friendly
- Intentional light/white exceptions are documented
- Check/build pass or unrelated failures are documented
