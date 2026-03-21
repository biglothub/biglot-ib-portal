#!/bin/bash
# ===========================================
# Smart Automation Orchestrator v2
# ===========================================
# Three-phase runner: BUILD → QA → POLISH
# With dev server verification, context persistence, and metrics
#
# Usage:
#   ./scripts/orchestrator.sh              # Run forever
#   ./scripts/orchestrator.sh 24           # Run for 24 hours
#   nohup ./scripts/orchestrator.sh &      # Run in background
#   tmux new -s dev './scripts/orchestrator.sh'  # Recommended
#
# Stop: Ctrl+C or kill the process
# Monitor: tail -f .auto-dev.log
# ===========================================

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGFILE="$PROJECT_DIR/.auto-dev.log"
LOCKFILE="$PROJECT_DIR/.auto-dev.lock"
HOURS_LIMIT="${1:-0}"  # 0 = unlimited
MAX_CONSECUTIVE_FAILURES=3
START_TIME=$(date +%s)

# Source library scripts
source "$PROJECT_DIR/scripts/lib/dev-server.sh"
source "$PROJECT_DIR/scripts/lib/metrics.sh"
source "$PROJECT_DIR/scripts/lib/context.sh"

# --- Logging ---
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# --- Lock file ---
if [ -f "$LOCKFILE" ]; then
    PID=$(cat "$LOCKFILE" 2>/dev/null)
    if kill -0 "$PID" 2>/dev/null; then
        echo "ERROR: Already running (PID $PID). Kill it first or remove $LOCKFILE"
        exit 1
    fi
    rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"

cleanup() {
    rm -f "$LOCKFILE"
    stop_dev_server
    echo ""
    log "=== Orchestrator stopped ==="
    log ""
    log "Final metrics:"
    print_metrics_summary | while IFS= read -r line; do log "$line"; done
    exit 0
}
trap cleanup EXIT INT TERM

# --- Time limit ---
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

# --- Task detection ---
has_remaining_tasks() {
    grep -q '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null
}

count_remaining() {
    grep -c '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo 0
}

count_completed() {
    grep -c '^\- \[x\]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo 0
}

# --- Phase detection ---
detect_phase() {
    # Check for BUILD tasks first (TZ-, INFRA-, ADV-, MOB-)
    if grep -qE '^\- \[ \] .*(TZ|INFRA|ADV|MOB)-' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        echo "build"
        return
    fi
    # Then QA
    if grep -qE '^\- \[ \] .*QA-' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        echo "qa"
        return
    fi
    # Then POLISH
    if grep -qE '^\- \[ \] .*POLISH-' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        echo "polish"
        return
    fi
    echo "done"
}

# --- Task size detection ---
get_task_cooldown() {
    local task_line="$1"
    if echo "$task_line" | grep -q '\[XL\]'; then
        echo 180
    elif echo "$task_line" | grep -q '\[L\]'; then
        echo 120
    elif echo "$task_line" | grep -q '\[M\]'; then
        echo 60
    else
        echo 30  # [S] or untagged
    fi
}

# --- Prompt assembly ---
assemble_prompt() {
    local phase="$1"
    local context
    context=$(get_context)

    local preamble
    preamble=$(cat "$PROJECT_DIR/prompts/shared-preamble.md")

    local phase_prompt
    case "$phase" in
        build)  phase_prompt=$(cat "$PROJECT_DIR/prompts/build.md") ;;
        qa)     phase_prompt=$(cat "$PROJECT_DIR/prompts/qa.md") ;;
        polish) phase_prompt=$(cat "$PROJECT_DIR/prompts/polish.md") ;;
    esac

    cat << EOF
$preamble

$phase_prompt

## Previous Session Context
$context
EOF
}

# ===========================================
# MAIN
# ===========================================
log "============================================"
log "  SMART ORCHESTRATOR v2"
log "============================================"
log "  Project:    $PROJECT_DIR"
log "  Time limit: $([ "$HOURS_LIMIT" -gt 0 ] && echo "${HOURS_LIMIT}h" || echo "unlimited")"
log "  Remaining:  $(count_remaining) tasks"
log "  Completed:  $(count_completed) tasks"
log "============================================"
log ""

cd "$PROJECT_DIR"

# Initialize state files
init_metrics
init_context

# Start dev server
start_dev_server
if ! is_dev_server_running; then
    log "WARNING: Dev server failed to start. Continuing without page verification."
fi

failures=0
batch_count=0

while true; do
    # Check if tasks remain
    if ! has_remaining_tasks; then
        log ""
        log "ALL TASKS COMPLETE"
        print_metrics_summary | while IFS= read -r line; do log "$line"; done
        log "TradeZella feature parity achieved!"
        exit 0
    fi

    check_time_limit

    # Detect phase
    phase=$(detect_phase)
    if [ "$phase" = "done" ]; then
        log "ALL TASKS COMPLETE"
        exit 0
    fi

    batch_count=$((batch_count + 1))
    remaining=$(count_remaining)
    completed=$(count_completed)
    log ""
    phase_upper=$(echo "$phase" | tr '[:lower:]' '[:upper:]')
    log "=== Task #$batch_count | Phase: $phase_upper | Remaining: $remaining | Completed: $completed ==="

    # Get next task line for cooldown calculation
    task_line=$(grep -m1 '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo "")
    cooldown=$(get_task_cooldown "$task_line")

    # Assemble prompt
    prompt=$(assemble_prompt "$phase")

    # Record start time
    task_start=$(date +%s)

    # Run Claude
    log "Running Claude (phase: $phase, cooldown: ${cooldown}s)..."
    if echo "$prompt" | \
        claude --model claude-sonnet-4-6 \
        --dangerously-skip-permissions \
        --verbose \
        2>&1 | tee -a "$LOGFILE"; then

        task_end=$(date +%s)
        task_duration=$((task_end - task_start))
        log "Task SUCCESS (${task_duration}s)"

        # Verify pages
        page_ok="true"
        if is_dev_server_running; then
            if ! verify_pages; then
                page_ok="false"
                log "Restarting dev server due to page failures..."
                restart_dev_server
            fi
        else
            log "Dev server not running, restarting..."
            start_dev_server
            page_ok="unknown"
        fi

        # Extract task ID from the task line
        task_id=$(echo "$task_line" | grep -oE '(TZ|INFRA|ADV|MOB|QA|POLISH)-[0-9]+' | head -1)
        task_id="${task_id:-unknown}"

        # Record metrics and context
        record_task "$task_id" "$phase" "success" "$task_duration" "$page_ok"
        update_context "$task_id" "$phase" "success" "$page_ok"

        failures=0
    else
        task_end=$(date +%s)
        task_duration=$((task_end - task_start))
        log "Task FAILED (${task_duration}s)"

        task_id=$(echo "$task_line" | grep -oE '(TZ|INFRA|ADV|MOB|QA|POLISH)-[0-9]+' | head -1)
        task_id="${task_id:-unknown}"

        record_task "$task_id" "$phase" "failure" "$task_duration" "false"
        update_context "$task_id" "$phase" "failure" "false"

        failures=$((failures + 1))
        if [ "$failures" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
            log "EMERGENCY STOP: $failures consecutive failures"
            log "Check $LOGFILE for details"
            exit 1
        fi
    fi

    # Print metrics
    log ""
    log "--- Metrics ---"
    print_metrics_summary | while IFS= read -r line; do log "$line"; done

    # Uptime
    elapsed=$(( $(date +%s) - START_TIME ))
    hours=$((elapsed / 3600))
    mins=$(( (elapsed % 3600) / 60 ))
    log "Uptime: ${hours}h${mins}m"

    # Cooldown
    if has_remaining_tasks; then
        log "Cooldown ${cooldown}s..."
        sleep "$cooldown"
    fi
done
