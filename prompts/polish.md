## Phase: POLISH (Consistency & Final Touch)

### Step 1: Pick Task
Read TASKS.md. Pick the FIRST unchecked task ([ ]) with prefix POLISH-, POLISH2-, or POLISH3-.
Mark it [~] (in progress).

### Step 2: Understand the Polish Task
Read the task description. Polish tasks focus on:
- Cross-page consistency (same patterns everywhere)
- Visual alignment and spacing
- Animation/transition smoothness
- Micro-interactions (hover states, focus rings)
- Accessibility improvements

### Step 3: Systematic Audit
Go file by file through the relevant pages/components:
1. List all files involved
2. Read each one completely
3. Compare patterns across files:
   - Same loading skeleton style?
   - Same empty state pattern?
   - Same card/panel styling?
   - Same responsive breakpoints?
   - Same button styles and sizes?
   - Same table/list patterns?

### Step 4: Apply Fixes
For each inconsistency:
1. Decide on the "canonical" pattern (the best existing one)
2. Apply it consistently across all instances
3. Don't invent new patterns — use what already works best

### Step 5: Verify
Run ALL checks — they must pass.

### Step 6: Commit + Update
- git add specific files
- git commit: "Polish: [description of what was made consistent]"
- Update TASKS.md: mark [x], add notes on what was polished

Consistency is the goal. Every page should feel like part of the same app.
