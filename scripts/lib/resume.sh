#!/bin/bash
# Resume capability — persist state between orchestrator sessions

RESUME_FILE="$PROJECT_DIR/.dev-resume.json"

save_resume_state() {
    local task_id="$1"
    local phase="$2"
    local status="$3"
    local error_context="${4:-}"

    jq -n \
        --arg tid "$task_id" \
        --arg ph "$phase" \
        --arg st "$status" \
        --arg err "$error_context" \
        --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    '{
        last_task: $tid,
        last_phase: $ph,
        last_status: $st,
        error_context: $err,
        timestamp: $ts
    }' > "$RESUME_FILE"
}

load_resume_state() {
    if [ ! -f "$RESUME_FILE" ]; then
        return 0
    fi

    # Reset any in-progress [~] tasks back to [ ]
    local last_task
    last_task=$(jq -r '.last_task // ""' "$RESUME_FILE" 2>/dev/null)
    if [ -n "$last_task" ] && grep -q "^\- \[~\] .*$last_task" "$PROJECT_DIR/TASKS.md" 2>/dev/null; then
        sed -i '' "s/^\- \[~\] \(.*${last_task}\)/- [ ] \1/" "$PROJECT_DIR/TASKS.md"
        log "Resume: reset in-progress task $last_task back to [ ]"
    fi

    # Load error context from previous session for retry injection
    local err
    err=$(jq -r '.error_context // ""' "$RESUME_FILE" 2>/dev/null)
    if [ -n "$err" ] && [ "$err" != "null" ]; then
        ERROR_CONTEXT="$err"
        log "Resume: loaded error context from previous session"
    fi

    local last_status
    last_status=$(jq -r '.last_status // ""' "$RESUME_FILE" 2>/dev/null)
    local timestamp
    timestamp=$(jq -r '.timestamp // ""' "$RESUME_FILE" 2>/dev/null)
    log "Resume: last session — task=$last_task status=$last_status at $timestamp"
}
