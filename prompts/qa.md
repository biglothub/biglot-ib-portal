## Phase: QA (Quality Assurance)

### Step 1: Pick Task
Read TASKS.md. Pick the FIRST unchecked task ([ ]) with prefix QA-, QA2-, or QA3-.
Mark it [~] (in progress).

### Step 2: Understand the QA Task
Read the task description carefully. It will tell you WHAT to verify.
Read the related feature code — EVERY file involved, don't skim.

### Step 3: Systematic Verification
For each checkpoint in the QA task:
1. Read the actual component/page code
2. Check if it meets the standard
3. If NOT — fix it immediately, don't just report

Common QA checks:
- Loading skeletons present and animated?
- Empty states with Thai messages?
- Error states with retry buttons?
- Mobile responsive (no overflow, readable at 375px)?
- Dark theme consistent (dark-bg, dark-surface, dark-border)?
- Thai labels for ALL user-facing text?
- SvelteKit 5 Runes ($state, $derived) — no $: reactive?
- No console.log or hardcoded values?
- Proper TypeScript types (no any)?
- Consistent spacing/alignment with other pages?

### Step 4: Fix Issues Found
For each issue:
1. Fix the code
2. Verify the fix compiles (svelte-check, build)
3. Move to next issue

### Step 5: Verify
Run ALL checks — they must pass.

### Step 6: Commit + Update
- git add specific files that were fixed
- git commit: "QA: [description of what was verified and fixed]"
- Update TASKS.md: mark [x], add notes on what was found and fixed

Thoroughness over speed. Read every line. Fix every issue.
