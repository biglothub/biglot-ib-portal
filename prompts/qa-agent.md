# QA Agent Prompt

## Task
Write comprehensive tests for: [MODULE_PATH]

## Context
- Test framework: vitest (with @testing-library/svelte for components)
- Test location: src/lib/__tests__/<module>.test.ts
- No Supabase mocking — focus on pure functions first

## Testing Strategy
1. **Unit tests for pure functions** (utils.ts, portfolio.ts)
   - Edge cases: empty inputs, zero, negative, null, undefined
   - Boundary values: exactly at thresholds
   - Thai timezone correctness (UTC+7 offset)
   - Realistic trade data shapes

2. **Integration tests for server functions** (server/portfolio.ts)
   - Mock Supabase client with realistic responses
   - Test KPI calculations with known datasets
   - Verify filter combinations

3. **Component smoke tests** (future, after unit coverage)
   - Render with minimal props
   - Render loading state
   - Render empty state

## Quality Bar
- Aim for 90%+ line coverage per file
- Every public function must have at least one test
- Document discovered bugs as comments, do NOT fix source code
