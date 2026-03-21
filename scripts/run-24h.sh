#!/bin/bash
# ===========================================
# 24-Hour Continuous Development Runner
# ===========================================
# Usage:
#   ./scripts/run-24h.sh              # Run forever
#   ./scripts/run-24h.sh 24           # Run for 24 hours
#   nohup ./scripts/run-24h.sh &      # Run in background
#   tmux new -s dev './scripts/run-24h.sh'  # Run in tmux (recommended)
#
# Stop: Ctrl+C or kill the process
# Monitor: tail -f .auto-dev.log
# ===========================================

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGFILE="$PROJECT_DIR/.auto-dev.log"
LOCKFILE="$PROJECT_DIR/.auto-dev.lock"
HOURS_LIMIT="${1:-0}"  # 0 = unlimited
BATCH_SIZE=5           # Tasks per batch before cooldown
BATCH_COOLDOWN=120     # 2 min between batches
TASK_COOLDOWN=30       # 30 sec between tasks
MAX_CONSECUTIVE_FAILURES=5
START_TIME=$(date +%s)

# Prevent multiple instances
if [ -f "$LOCKFILE" ]; then
    PID=$(cat "$LOCKFILE" 2>/dev/null)
    if kill -0 "$PID" 2>/dev/null; then
        echo "ERROR: Already running (PID $PID). Kill it first or remove $LOCKFILE"
        exit 1
    fi
    rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"; echo ""; log "=== Runner stopped ==="; exit 0' EXIT INT TERM

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

check_time_limit() {
    if [ "$HOURS_LIMIT" -gt 0 ]; then
        local elapsed=$(( $(date +%s) - START_TIME ))
        local limit_secs=$((HOURS_LIMIT * 3600))
        if [ "$elapsed" -ge "$limit_secs" ]; then
            log "Time limit reached (${HOURS_LIMIT}h). Stopping."
            exit 0
        fi
    fi
}

has_remaining_tasks() {
    grep -q '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null
}

count_remaining() {
    grep -c '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo 0
}

count_completed() {
    grep -c '^\- \[x\]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo 0
}

# --- Start ---
log "============================================"
log "  24H CONTINUOUS DEVELOPMENT RUNNER"
log "============================================"
log "  Project:    $PROJECT_DIR"
log "  Time limit: $([ "$HOURS_LIMIT" -gt 0 ] && echo "${HOURS_LIMIT}h" || echo "unlimited")"
log "  Batch size: $BATCH_SIZE tasks"
log "  Log:        $LOGFILE"
log "  Remaining:  $(count_remaining) tasks"
log "============================================"
log ""

cd "$PROJECT_DIR"
total_completed=0
total_failed=0
failures=0
batch_count=0

while true; do
    # Check if tasks remain
    if ! has_remaining_tasks; then
        log ""
        log "ALL_TASKS_COMPLETE"
        log "Total completed: $total_completed | Failed: $total_failed"
        log "TradeZella feature parity achieved!"
        exit 0
    fi

    # Check time limit
    check_time_limit

    batch_count=$((batch_count + 1))
    remaining=$(count_remaining)
    completed=$(count_completed)
    log ""
    log "=== Batch #$batch_count | Remaining: $remaining | Completed: $completed ==="

    # Run a batch of tasks
    for i in $(seq 1 $BATCH_SIZE); do
        if ! has_remaining_tasks; then break; fi
        check_time_limit

        task_num=$((total_completed + total_failed + 1))
        log "--- Task attempt #$task_num (batch $batch_count, item $i/$BATCH_SIZE) ---"

        # Run Claude Code with detailed quality prompt
        if echo 'You are building IB-Portal to match TradeZella quality (app.tradezella.com).

## Step 1: Pick Task
Read TASKS.md. Pick the FIRST task marked "[ ]". Mark it "[~]".

## Step 2: Research
- Read CLAUDE.md for conventions
- Read tradezella-explore/GAP_ANALYSIS.md for the feature spec (what TradeZella has)
- Read tradezella-explore/DEVELOPMENT_PHASES.md for implementation details
- LOOK AT the TradeZella screenshots to match their UI:
  - tradezella-explore/screenshots/dashboard.png (dashboard layout)
  - tradezella-explore/screenshots/deep/ folder (detailed UI per page)
  - tradezella-explore/screenshots/final/ folder (clean screenshots)
  - Match the relevant screenshot for the feature you are building
  - For example: building Settings? Look at settings.png, settings-profile.png, settings-trade.png
  - Building Reports? Look at reports.png, reports-calendar.png, reports-symbols.png etc.
- Study existing similar components in the codebase for patterns

## Step 3: Implement with Quality
Build it to production quality. EVERY component must have:
- Loading skeleton (animated placeholder while data loads)
- Empty state with helpful Thai message
- Error state with retry button
- Mobile responsive (test at 375px width mentally)
- Dark theme (dark-bg, dark-surface, dark-border, brand-primary)
- Thai labels for ALL user-facing text
- SvelteKit 5 Runes ($state, $derived) — NO $: reactive
- Server-side computation (no heavy client loops)
- Proper TypeScript types (no any)
- Use formatCurrency/formatPercent/formatNumber from $lib/utils
- Smooth transitions and hover states
- Consistent spacing and alignment with existing pages

## Step 4: Self-QA (CRITICAL)
Before committing, review your own code:
- Does it match what TradeZella has? Check GAP_ANALYSIS.md
- Are there edge cases? (0 trades, 1 trade, 1000 trades)
- Does the layout break on mobile?
- Are all strings in Thai?
- Is there a loading skeleton?
- Is there an empty state?
- Any console.log left?
- Any hardcoded values that should be dynamic?
Fix ALL issues found before proceeding.

## Step 5: Verify
Run ALL checks — they must pass:
1. npx svelte-check (ignore 2 web-push errors)
2. npm run build
3. npx vitest run

## Step 6: Commit + Update
- git add specific files (never git add .)
- git commit with descriptive message
- Update TASKS.md: mark [x], add session notes with details of what was built

ONE task per session. Quality over speed.' | \
            claude --model claude-opus-4-6 \
            --dangerously-skip-permissions \
            --verbose \
            2>&1 | tee -a "$LOGFILE"; then

            log "Task SUCCESS"
            total_completed=$((total_completed + 1))
            failures=0
        else
            log "Task FAILED"
            total_failed=$((total_failed + 1))
            failures=$((failures + 1))

            if [ "$failures" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
                log "EMERGENCY STOP: $failures consecutive failures"
                log "Check $LOGFILE for details"
                exit 1
            fi
        fi

        # Cooldown between tasks
        if has_remaining_tasks && [ "$i" -lt "$BATCH_SIZE" ]; then
            log "Task cooldown ${TASK_COOLDOWN}s..."
            sleep "$TASK_COOLDOWN"
        fi
    done

    # Batch cooldown
    elapsed=$(( $(date +%s) - START_TIME ))
    hours=$((elapsed / 3600))
    mins=$(( (elapsed % 3600) / 60 ))
    log ""
    log "Batch #$batch_count complete | Uptime: ${hours}h${mins}m | Done: $total_completed | Failed: $total_failed"

    if has_remaining_tasks; then
        log "Batch cooldown ${BATCH_COOLDOWN}s..."
        sleep "$BATCH_COOLDOWN"
    fi
done
