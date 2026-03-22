#!/bin/bash
# ===========================================
# Smart Automation Orchestrator v4
# ===========================================
# Unified entry point for all auto-dev modes.
# Improvements over v3:
#   - Scoped permissions (no --dangerously-skip-permissions)
#   - Git checkpoint/rollback safety net
#   - Test gate (vitest) in addition to build gate
#   - Error context injection for smarter retries
#   - Log rotation, notifications, resume capability
#   - Externalized config (auto-dev.conf)
#
# Usage:
#   ./scripts/orchestrator.sh                    # Run forever, auto-detect phase
#   ./scripts/orchestrator.sh 24                 # Run for 24 hours
#   ./scripts/orchestrator.sh --phase qa         # Force QA phase
#   ./scripts/orchestrator.sh --task DEPLOY-001  # Run specific task then exit
#   ./scripts/orchestrator.sh --dry-run          # Show plan without executing
#   ./scripts/orchestrator.sh --no-server        # Skip dev server management
#   ./scripts/orchestrator.sh --resume           # Resume from previous session
#
# Stop: Ctrl+C or kill the process
# Monitor: tail -f .auto-dev.log
# Dashboard: ./scripts/dashboard.sh
# Structured log: cat .auto-dev.jsonl | jq
# ===========================================

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGFILE="$PROJECT_DIR/.auto-dev.log"
LOCKFILE="$PROJECT_DIR/.auto-dev.lock"
START_TIME=$(date +%s)

# --- Default options ---
HOURS_LIMIT=0
FORCE_PHASE=""
FORCE_TASK=""
DRY_RUN=false
NO_SERVER=false
SKIP_BUILD_CHECK=false
RESUME=false
ERROR_CONTEXT=""

# --- Default config (can be overridden by auto-dev.conf) ---
CLAUDE_MODEL="claude-opus-4-6"
CLAUDE_ALLOWED_TOOLS="Bash(npm:*),Bash(npx:*),Bash(git:*),Bash(node:*),Bash(cat:*),Bash(ls:*),Bash(find:*),Bash(head:*),Bash(tail:*),Bash(wc:*),Bash(grep:*),Bash(mkdir:*),Bash(touch:*),Bash(cp:*),Bash(mv:*),Bash(echo:*),Bash(sed:*),Bash(sort:*),Bash(curl:*),Read,Write,Edit,Glob,Grep,TodoRead,TodoWrite"
MAX_CONSECUTIVE_FAILURES=3
BACKOFF_BASE_SECS=120
BACKOFF_MAX_SECS=1800
HEALTH_RUN_BUILD=true
HEALTH_RUN_TESTS=true
HEALTH_BUILD_CMD="npm run build"
HEALTH_TEST_CMD="npm test"
COOLDOWN_S=30
COOLDOWN_M=60
COOLDOWN_L=120
COOLDOWN_XL=180
TASK_ID_PATTERN='(CLEAN|DEPLOY|SCALE|ENHANCE|SEC|FIX|FEAT|TZ|INFRA|ADV|MOB|QA[0-9]*|POLISH[0-9]*)-[0-9]+'

# --- Load config file (overrides defaults above) ---
CONFIG_FILE="$PROJECT_DIR/scripts/auto-dev.conf"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# --- CLI argument parsing ---
parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --phase)
                FORCE_PHASE="$2"
                shift 2
                ;;
            --task)
                FORCE_TASK="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-server)
                NO_SERVER=true
                shift
                ;;
            --skip-build-check)
                SKIP_BUILD_CHECK=true
                shift
                ;;
            --resume)
                RESUME=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            [0-9]*)
                HOURS_LIMIT="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << 'HELP'
Smart Automation Orchestrator v4

Usage: ./scripts/orchestrator.sh [HOURS] [OPTIONS]

Arguments:
  HOURS                     Run for N hours (0 = unlimited, default)

Options:
  --phase <build|qa|polish> Force a specific phase (skip auto-detect)
  --task <TASK-ID>          Force a specific task (e.g., DEPLOY-001)
  --dry-run                 Show what would be executed, don't run Claude
  --no-server               Skip dev server start/verify
  --skip-build-check        Skip initial build verification in preflight
  --resume                  Resume from previous session (reset [~] tasks)
  -h, --help                Show this help

Examples:
  ./scripts/orchestrator.sh 24                     # 24-hour run
  ./scripts/orchestrator.sh --phase qa             # Force QA mode
  ./scripts/orchestrator.sh --task DEPLOY-001      # Run specific task
  ./scripts/orchestrator.sh --resume               # Resume previous session
  ./scripts/orchestrator.sh --dry-run              # Preview execution plan
  tmux new -s dev './scripts/orchestrator.sh 48'   # 48h in tmux

Monitor:
  tail -f .auto-dev.log                            # Live log
  ./scripts/dashboard.sh                           # Pretty metrics
  cat .auto-dev.jsonl | jq                         # Structured log
HELP
}

parse_args "$@"

# Source library scripts (logging must be first — others use log())
source "$PROJECT_DIR/scripts/lib/logging.sh"
source "$PROJECT_DIR/scripts/lib/preflight.sh"
source "$PROJECT_DIR/scripts/lib/dev-server.sh"
source "$PROJECT_DIR/scripts/lib/metrics.sh"
source "$PROJECT_DIR/scripts/lib/context.sh"
source "$PROJECT_DIR/scripts/lib/checkpoint.sh"
source "$PROJECT_DIR/scripts/lib/notify.sh"
source "$PROJECT_DIR/scripts/lib/resume.sh"

# --- Log rotation at startup ---
rotate_logs

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
    if [ "$NO_SERVER" != "true" ]; then
        stop_dev_server
    fi
    echo ""
    log "=== Orchestrator stopped ==="
    log ""
    log "Final metrics:"
    print_metrics_summary | while IFS= read -r line; do log "$line"; done
    log_json "orchestrator_stop" "uptime_s=$(($(date +%s) - START_TIME))"
    notify_stopped "Orchestrator stopped (uptime: $(format_uptime))"
    exit 0
}
trap cleanup EXIT INT TERM

# --- Helpers ---
format_uptime() {
    local elapsed=$(( $(date +%s) - START_TIME ))
    local hours=$((elapsed / 3600))
    local mins=$(( (elapsed % 3600) / 60 ))
    echo "${hours}h${mins}m"
}

check_time_limit() {
    if [ "$HOURS_LIMIT" -gt 0 ]; then
        local elapsed=$(( $(date +%s) - START_TIME ))
        local limit_secs=$((HOURS_LIMIT * 3600))
        if [ "$elapsed" -ge "$limit_secs" ]; then
            log "Time limit reached (${HOURS_LIMIT}h). Stopping."
            notify_stopped "Time limit reached (${HOURS_LIMIT}h)"
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

extract_task_id() {
    echo "$1" | grep -oE "$TASK_ID_PATTERN" | head -1
}

get_next_task_line() {
    if [ -n "$FORCE_TASK" ]; then
        local line
        line=$(grep -m1 "$FORCE_TASK" "$PROJECT_DIR/TASKS.md" 2>/dev/null)
        if [ -n "$line" ]; then
            echo "$line"
            return
        fi
        log "WARNING: Forced task $FORCE_TASK not found in TASKS.md. Falling back to auto."
    fi
    grep -m1 '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo ""
}

# --- Phase detection ---
detect_phase() {
    if [ -n "$FORCE_PHASE" ]; then
        echo "$FORCE_PHASE"
        return
    fi
    if grep -qE '^\- \[ \] .*(CLEAN|DEPLOY|SCALE|ENHANCE|SEC|FIX|FEAT|TZ|INFRA|ADV|MOB)-' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        echo "build"
        return
    fi
    if grep -qE '^\- \[ \] .*QA[0-9]*-' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        echo "qa"
        return
    fi
    if grep -qE '^\- \[ \] .*POLISH[0-9]*-' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        echo "polish"
        return
    fi
    echo "done"
}

# --- Task size detection ---
get_task_cooldown() {
    local task_line="$1"
    if echo "$task_line" | grep -q '\[XL\]'; then
        echo "$COOLDOWN_XL"
    elif echo "$task_line" | grep -q '\[L\]'; then
        echo "$COOLDOWN_L"
    elif echo "$task_line" | grep -q '\[M\]'; then
        echo "$COOLDOWN_M"
    else
        echo "$COOLDOWN_S"
    fi
}

# --- Health gates (build + test) ---
LAST_BUILD_ERROR=""
LAST_TEST_ERROR=""

run_health_gates() {
    local build_ok=true
    local test_ok=true
    LAST_BUILD_ERROR=""
    LAST_TEST_ERROR=""

    # Gate 1: Build
    if [ "$HEALTH_RUN_BUILD" = "true" ]; then
        log "Health gate: running '$HEALTH_BUILD_CMD'..."
        local build_output
        build_output=$(cd "$PROJECT_DIR" && $HEALTH_BUILD_CMD 2>&1)
        if [ $? -ne 0 ]; then
            log "Health gate: BUILD FAILED"
            build_ok=false
            LAST_BUILD_ERROR=$(echo "$build_output" | tail -30)
        else
            log "Health gate: build passed"
        fi
    fi

    # Gate 2: Tests (only if build passed)
    if [ "$build_ok" = true ] && [ "$HEALTH_RUN_TESTS" = "true" ]; then
        log "Health gate: running '$HEALTH_TEST_CMD'..."
        local test_output
        test_output=$(cd "$PROJECT_DIR" && $HEALTH_TEST_CMD 2>&1)
        if [ $? -ne 0 ]; then
            log "Health gate: TESTS FAILED"
            test_ok=false
            LAST_TEST_ERROR=$(echo "$test_output" | tail -30)
        else
            log "Health gate: tests passed"
        fi
    fi

    # Log composite result
    if [ "$build_ok" = true ] && [ "$test_ok" = true ]; then
        log "Health gate: ALL PASSED"
        log_json "health_gate" "status=passed" "build=passed" "tests=passed"
        return 0
    else
        log_json "health_gate" "status=failed" \
            "build=$([ "$build_ok" = true ] && echo passed || echo failed)" \
            "tests=$([ "$test_ok" = true ] && echo passed || echo failed)"
        return 1
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

    # Task override hint
    local task_hint=""
    if [ -n "$FORCE_TASK" ]; then
        task_hint="

## IMPORTANT: Task Override
Work on task **$FORCE_TASK** specifically. Do NOT pick a different task."
    fi

    # Error context for retry
    local error_hint=""
    if [ -n "$ERROR_CONTEXT" ]; then
        error_hint="

## RETRY: Previous Attempt Failed
The previous attempt at this task failed. Analyze the error below and try a different approach.
\`\`\`
$ERROR_CONTEXT
\`\`\`"
    fi

    cat << EOF
$preamble

$phase_prompt
$task_hint
$error_hint

## Previous Session Context
$context
EOF
}

# ===========================================
# MAIN
# ===========================================

# Pre-flight checks
if ! run_preflight_checks; then
    exit 1
fi

log "============================================"
log "  SMART ORCHESTRATOR v4"
log "============================================"
log "  Project:    $PROJECT_DIR"
log "  Time limit: $([ "$HOURS_LIMIT" -gt 0 ] && echo "${HOURS_LIMIT}h" || echo "unlimited")"
log "  Phase:      $([ -n "$FORCE_PHASE" ] && echo "$FORCE_PHASE (forced)" || echo "auto-detect")"
log "  Task:       $([ -n "$FORCE_TASK" ] && echo "$FORCE_TASK (forced)" || echo "auto-pick")"
log "  Dry run:    $DRY_RUN"
log "  Dev server: $([ "$NO_SERVER" = "true" ] && echo "disabled" || echo "enabled")"
log "  Resume:     $RESUME"
log "  Model:      $CLAUDE_MODEL"
log "  Remaining:  $(count_remaining) tasks"
log "  Completed:  $(count_completed) tasks"
log "============================================"
log ""

log_json "orchestrator_start" \
    "hours_limit=$HOURS_LIMIT" \
    "force_phase=$FORCE_PHASE" \
    "force_task=$FORCE_TASK" \
    "dry_run=$DRY_RUN" \
    "resume=$RESUME" \
    "model=$CLAUDE_MODEL" \
    "remaining=$(count_remaining)" \
    "completed=$(count_completed)"

cd "$PROJECT_DIR"

# Initialize state
init_metrics
init_context

# Resume from previous session if requested
if [ "$RESUME" = true ]; then
    load_resume_state
fi

# Start dev server (unless disabled)
if [ "$NO_SERVER" != "true" ]; then
    start_dev_server
    if ! is_dev_server_running; then
        log "WARNING: Dev server failed to start. Continuing without page verification."
    fi
fi

failures=0
batch_count=0

while true; do
    # Check if tasks remain
    if ! has_remaining_tasks; then
        log ""
        log "ALL TASKS COMPLETE"
        print_metrics_summary | while IFS= read -r line; do log "$line"; done
        log_json "all_tasks_complete"
        notify_all_done
        exit 0
    fi

    check_time_limit

    # Detect phase
    phase=$(detect_phase)
    if [ "$phase" = "done" ]; then
        log "ALL TASKS COMPLETE"
        log_json "all_tasks_complete"
        notify_all_done
        exit 0
    fi

    batch_count=$((batch_count + 1))
    remaining=$(count_remaining)
    completed=$(count_completed)
    phase_upper=$(echo "$phase" | tr '[:lower:]' '[:upper:]')
    log ""
    log "=== Task #$batch_count | Phase: $phase_upper | Remaining: $remaining | Completed: $completed ==="

    # Get next task
    task_line=$(get_next_task_line)
    task_id=$(extract_task_id "$task_line")
    task_id="${task_id:-unknown}"
    cooldown=$(get_task_cooldown "$task_line")

    log_json "task_start" "task_id=$task_id" "phase=$phase" "batch=$batch_count"

    # --- Dry run mode ---
    if [ "$DRY_RUN" = true ]; then
        log "[DRY RUN] Phase: $phase_upper"
        log "[DRY RUN] Task: $task_id"
        log "[DRY RUN] Line: $task_line"
        log "[DRY RUN] Cooldown: ${cooldown}s"
        prompt=$(assemble_prompt "$phase")
        log "[DRY RUN] Prompt length: $(echo "$prompt" | wc -c | tr -d ' ') chars"
        log "[DRY RUN] Model: $CLAUDE_MODEL"
        log "[DRY RUN] Allowed tools: $CLAUDE_ALLOWED_TOOLS"
        log_json "dry_run" "task_id=$task_id" "phase=$phase" "cooldown=$cooldown"

        if [ -n "$FORCE_TASK" ]; then
            log "[DRY RUN] Single task mode — would exit after this task."
            exit 0
        fi
        sleep 1
        continue
    fi

    # Create git checkpoint before running Claude
    create_checkpoint "$task_id"

    # Assemble prompt
    prompt=$(assemble_prompt "$phase")

    # Record start time
    task_start=$(date +%s)

    # Run Claude with scoped permissions
    log "Running Claude (model: $CLAUDE_MODEL, phase: $phase, cooldown: ${cooldown}s)..."
    task_output=$(mktemp)
    if echo "$prompt" | \
        claude --model "$CLAUDE_MODEL" \
        --allowedTools "$CLAUDE_ALLOWED_TOOLS" \
        --verbose \
        2>&1 | tee -a "$LOGFILE" | tee "$task_output" > /dev/null; then

        task_end=$(date +%s)
        task_duration=$((task_end - task_start))
        log "Task SUCCESS (${task_duration}s)"

        # Verify pages
        page_ok="true"
        if [ "$NO_SERVER" != "true" ]; then
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
        else
            page_ok="skipped"
        fi

        # Health gates: build + tests
        build_ok="unknown"
        if run_health_gates; then
            build_ok="true"
            # Health gates passed — clear checkpoint, clear error context
            clear_checkpoint
            ERROR_CONTEXT=""
        else
            build_ok="false"
            # Health gates failed — rollback to checkpoint
            log "Health gates failed after $task_id. Rolling back..."
            rollback_to_checkpoint

            # Capture error context for retry
            if [ -n "$LAST_BUILD_ERROR" ]; then
                ERROR_CONTEXT="Build failed:\n$LAST_BUILD_ERROR"
            elif [ -n "$LAST_TEST_ERROR" ]; then
                ERROR_CONTEXT="Tests failed:\n$LAST_TEST_ERROR"
            fi

            # Treat as failure for metrics
            record_task "$task_id" "$phase" "rollback" "$task_duration" "$page_ok" "$build_ok"
            update_context "$task_id" "$phase" "rollback" "$page_ok" "$ERROR_CONTEXT"
            save_resume_state "$task_id" "$phase" "rollback" "$ERROR_CONTEXT"
            log_json "task_rollback" "task_id=$task_id" "phase=$phase" "duration=$task_duration"

            failures=$((failures + 1))
            notify_failure "$task_id" "$failures"

            # Backoff before retry
            backoff_secs=$((BACKOFF_BASE_SECS * (1 << (failures - 1))))
            if [ "$backoff_secs" -gt "$BACKOFF_MAX_SECS" ]; then
                backoff_secs="$BACKOFF_MAX_SECS"
            fi
            log "Rolled back. Waiting $((backoff_secs / 60))min before retry..."
            sleep "$backoff_secs"

            # Print metrics and continue
            log ""
            log "--- Metrics ---"
            print_metrics_summary | while IFS= read -r line; do log "$line"; done
            log "Uptime: $(format_uptime)"
            rm -f "$task_output"
            continue
        fi

        # Record success metrics and context
        record_task "$task_id" "$phase" "success" "$task_duration" "$page_ok" "$build_ok"
        update_context "$task_id" "$phase" "success" "$page_ok"
        save_resume_state "$task_id" "$phase" "success"
        log_json "task_complete" "task_id=$task_id" "phase=$phase" "duration=$task_duration" "page_ok=$page_ok" "build_ok=$build_ok"

        failures=0
        notify_success "$task_id"

        # Exit if single-task mode
        if [ -n "$FORCE_TASK" ]; then
            log "Forced task $FORCE_TASK complete. Exiting."
            rm -f "$task_output"
            exit 0
        fi
    else
        task_end=$(date +%s)
        task_duration=$((task_end - task_start))
        log "Task FAILED (${task_duration}s)"

        # Capture error output for retry context
        ERROR_CONTEXT=$(tail -50 "$task_output" 2>/dev/null || echo "No output captured")

        # Rollback to pre-task state
        rollback_to_checkpoint

        record_task "$task_id" "$phase" "failure" "$task_duration" "false" "unknown"
        update_context "$task_id" "$phase" "failure" "false" "$ERROR_CONTEXT"
        save_resume_state "$task_id" "$phase" "failure" "$ERROR_CONTEXT"
        log_json "task_failed" "task_id=$task_id" "phase=$phase" "duration=$task_duration" "failures=$((failures + 1))"

        failures=$((failures + 1))
        notify_failure "$task_id" "$failures"

        # Exit if single-task mode (even on failure)
        if [ -n "$FORCE_TASK" ]; then
            log "Forced task $FORCE_TASK failed. Exiting."
            rm -f "$task_output"
            exit 1
        fi

        # Exponential backoff
        backoff_secs=$((BACKOFF_BASE_SECS * (1 << (failures - 1))))
        if [ "$backoff_secs" -gt "$BACKOFF_MAX_SECS" ]; then
            backoff_secs="$BACKOFF_MAX_SECS"
        fi
        backoff_mins=$((backoff_secs / 60))
        log "Consecutive failures: $failures — waiting ${backoff_mins}min before retry..."
        sleep "$backoff_secs"
    fi

    rm -f "$task_output"

    # Print metrics
    log ""
    log "--- Metrics ---"
    print_metrics_summary | while IFS= read -r line; do log "$line"; done
    log "Uptime: $(format_uptime)"

    # Cooldown
    if has_remaining_tasks; then
        log "Cooldown ${cooldown}s..."
        sleep "$cooldown"
    fi
done
