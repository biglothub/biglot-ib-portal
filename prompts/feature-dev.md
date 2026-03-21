# Feature Development Prompt

## Task
Implement: [FEATURE_NAME]

## Context
- Project: IB-Portal (SvelteKit 5 + Supabase + Tailwind)
- Read CLAUDE.md for full conventions
- Read TASKS.md for task details

## Requirements
[Describe the feature]

## Constraints
1. SvelteKit 5 Runes ($state, $derived) — no $: reactivity
2. Thai language for user-facing labels
3. Dark theme (dark-bg, dark-surface, dark-border, brand-primary)
4. Every component needs: loading skeleton, empty state, mobile responsive
5. Server-side computation in +page.server.ts or $lib/server/
6. Use $lib/utils formatters (formatCurrency, formatPercent, formatNumber)
7. Follow existing patterns in similar features

## Definition of Done
- [ ] Feature works as described
- [ ] `npx svelte-check` passes (ignore 2 web-push errors)
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (if tests exist)
- [ ] Loading skeleton present
- [ ] Empty state present
- [ ] Mobile responsive
- [ ] No console.log in production code
- [ ] Committed with descriptive message
