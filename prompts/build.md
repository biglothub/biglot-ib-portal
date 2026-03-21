## Phase: BUILD (Feature Implementation)

### Step 1: Pick Task
Read TASKS.md. Pick the FIRST unchecked task ([ ]) with prefix TZ-, INFRA-, ADV-, or MOB-.
Mark it [~] (in progress).

### Step 2: Research (SPEND TIME HERE)
This is the most important step. Do NOT rush.

1. Read CLAUDE.md for conventions and architecture
2. Read tradezella-explore/GAP_ANALYSIS.md for the feature spec
3. Read tradezella-explore/DEVELOPMENT_PHASES.md for implementation details
4. LOOK AT the TradeZella screenshots matching your feature:
   - Building Dashboard? Look at dashboard.png
   - Building Settings? Look at settings.png, settings-profile.png, settings-trade.png
   - Building Reports? Look at reports.png, reports-calendar.png, reports-symbols.png
   - Building Trades? Look at trades.png, trade-detail.png
   - Check both screenshots/deep/ and screenshots/final/ folders
5. Study existing similar components in the codebase for patterns
6. Read the existing page/component you'll modify to understand current state

### Step 3: Implement with Quality
Build it to production quality. Match the TradeZella screenshot as closely as possible.
Follow all quality standards from the preamble.

### Step 4: Self-QA (CRITICAL)
Before committing, review your own code line by line:
- Does it match what TradeZella has? Re-check GAP_ANALYSIS.md
- Edge cases: 0 trades, 1 trade, 1000 trades
- Layout on mobile (375px)?
- All strings in Thai?
- Loading skeleton present?
- Empty state present?
- Any console.log left?
- Any hardcoded values?
Fix ALL issues before proceeding.

### Step 5: Verify
Run ALL checks — they must pass.

### Step 6: Commit + Update
- git add specific files
- git commit with descriptive message
- Update TASKS.md: mark [x], add session notes with what was built

Quality over speed. ONE task per session.
