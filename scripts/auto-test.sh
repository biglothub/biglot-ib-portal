#!/bin/bash
# ===========================================
# Auto-Test Loop for IB-Portal
# ===========================================
# Usage: ./scripts/auto-test.sh [max_iterations]
# Stop:  Ctrl+C
# ===========================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCKFILE="$PROJECT_DIR/.auto-test.lock"
LOGFILE="$PROJECT_DIR/.auto-test.log"
MAX_ITERATIONS="${1:-5}"
COOLDOWN_SECONDS=60
MAX_CONSECUTIVE_FAILURES=2

# Prevent multiple instances
if [ -f "$LOCKFILE" ]; then
    PID=$(cat "$LOCKFILE" 2>/dev/null)
    if kill -0 "$PID" 2>/dev/null; then
        echo "ERROR: auto-test already running (PID $PID)."
        exit 1
    fi
    rm "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

log "=== Auto-Test Loop Started (max=$MAX_ITERATIONS) ==="

iteration=0
failures=0

while [ "$iteration" -lt "$MAX_ITERATIONS" ]; do
    iteration=$((iteration + 1))
    log "--- Test Iteration $iteration / $MAX_ITERATIONS ---"

    cd "$PROJECT_DIR"

    if claude -p "$(cat prompts/qa-agent.md)" \
        --allowedTools "Bash(npm*),Bash(npx*),Bash(git*),Read,Write,Edit" \
        2>&1 | tee -a "$LOGFILE"; then
        log "Iteration $iteration: SUCCESS"
        failures=0
    else
        failures=$((failures + 1))
        log "Iteration $iteration: FAILED (failures: $failures)"

        if [ "$failures" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
            log "STOPPING: $MAX_CONSECUTIVE_FAILURES consecutive failures."
            break
        fi
    fi

    if [ "$iteration" -lt "$MAX_ITERATIONS" ]; then
        log "Cooling down for ${COOLDOWN_SECONDS}s..."
        sleep "$COOLDOWN_SECONDS"
    fi
done

log "=== Auto-Test Loop Finished ==="
