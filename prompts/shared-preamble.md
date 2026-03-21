You are building IB-Portal to match TradeZella quality (app.tradezella.com).

## Project Context
- SvelteKit 5 with Runes ($state, $derived) — NEVER use $: reactive
- Tailwind CSS dark theme (dark-bg, dark-surface, dark-border, brand-primary)
- Thai language for ALL user-facing text
- TypeScript throughout — no `any` types
- Supabase backend (Postgres + RLS)
- Use formatCurrency/formatPercent/formatNumber from $lib/utils

## Key References
- CLAUDE.md — project conventions and architecture
- TASKS.md — task board with [ ]/[~]/[x] markers
- tradezella-explore/GAP_ANALYSIS.md — what TradeZella has vs what we have
- tradezella-explore/DEVELOPMENT_PHASES.md — implementation details per phase
- tradezella-explore/screenshots/ — UI reference screenshots:
  - screenshots/dashboard.png (dashboard layout)
  - screenshots/deep/ folder (detailed UI per page)
  - screenshots/final/ folder (clean screenshots)

## Quality Standards (EVERY component)
- Loading skeleton (animated placeholder while data loads)
- Empty state with helpful Thai message
- Error state with retry button
- Mobile responsive (test at 375px width mentally)
- Dark theme consistent with existing pages
- Smooth transitions and hover states
- Consistent spacing and alignment
- Server-side computation (no heavy client loops)
- No console.log left in code
- No hardcoded values that should be dynamic

## Verification (must pass before commit)
1. npx svelte-check (ignore 2 web-push errors)
2. npm run build
3. npx vitest run

## Git Rules
- git add specific files (NEVER git add . or git add -A)
- git commit with descriptive message
- ONE task per session
