#!/bin/bash
# ===========================================
# Auto-Dev Loop for IB-Portal
# ===========================================
# Usage: ./scripts/auto-dev.sh [max_iterations]
# Stop:  Ctrl+C
# ===========================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCKFILE="$PROJECT_DIR/.auto-dev.lock"
LOGFILE="$PROJECT_DIR/.auto-dev.log"
MAX_ITERATIONS="${1:-10}"
COOLDOWN_SECONDS=60
MAX_CONSECUTIVE_FAILURES=3

# Prevent multiple instances
if [ -f "$LOCKFILE" ]; then
    PID=$(cat "$LOCKFILE" 2>/dev/null)
    if kill -0 "$PID" 2>/dev/null; then
        echo "ERROR: auto-dev already running (PID $PID). Remove $LOCKFILE to override."
        exit 1
    fi
    echo "WARN: Stale lock file found. Removing."
    rm "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

log "=== Auto-Dev Loop Started ==="
log "    Project: $PROJECT_DIR"
log "    Max iterations: $MAX_ITERATIONS"
log "    Cooldown: ${COOLDOWN_SECONDS}s"
log "    Log: $LOGFILE"
log ""

iteration=0
failures=0

while [ "$iteration" -lt "$MAX_ITERATIONS" ]; do
    iteration=$((iteration + 1))
    log "--- Iteration $iteration / $MAX_ITERATIONS ---"

    # Check if there are remaining tasks
    if ! grep -q '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        log "No remaining tasks in TASKS.md. Stopping."
        break
    fi

    cd "$PROJECT_DIR"

    # Run Claude Code with dev-loop command
    if claude -p "$(cat prompts/feature-dev.md)" \
        --allowedTools "Bash(npm*),Bash(npx*),Bash(git*),Bash(ls*),Bash(cat*),Bash(find*),Read,Write,Edit" \
        2>&1 | tee -a "$LOGFILE"; then
        log "Iteration $iteration: SUCCESS"
        failures=0
    else
        failures=$((failures + 1))
        log "Iteration $iteration: FAILED (consecutive failures: $failures)"

        if [ "$failures" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
            log "STOPPING: $MAX_CONSECUTIVE_FAILURES consecutive failures reached."
            break
        fi
    fi

    # Cooldown
    if [ "$iteration" -lt "$MAX_ITERATIONS" ]; then
        log "Cooling down for ${COOLDOWN_SECONDS}s..."
        sleep "$COOLDOWN_SECONDS"
    fi
done

log "=== Auto-Dev Loop Finished ($iteration iterations) ==="
log "    Check TASKS.md for status"
log "    Check git log for commits"
