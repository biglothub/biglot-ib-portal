#!/bin/bash
# Pre-flight checks before starting orchestrator

run_preflight_checks() {
    local errors=0

    # 1. Check node_modules exists
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        log "PREFLIGHT FAIL: node_modules missing. Run 'npm install' first."
        errors=$((errors + 1))
    fi

    # 2. Check .env or .env.local exists
    if [ ! -f "$PROJECT_DIR/.env" ] && [ ! -f "$PROJECT_DIR/.env.local" ]; then
        log "PREFLIGHT WARN: No .env or .env.local found."
    fi

    # 3. Check TASKS.md exists
    if [ ! -f "$PROJECT_DIR/TASKS.md" ]; then
        log "PREFLIGHT FAIL: TASKS.md not found."
        errors=$((errors + 1))
    fi

    # 4. Check git is clean (warn only)
    local dirty_count
    dirty_count=$(cd "$PROJECT_DIR" && git status --porcelain 2>/dev/null | grep -v '^\?\?' | wc -l | tr -d ' ')
    if [ "$dirty_count" -gt 0 ]; then
        log "PREFLIGHT WARN: $dirty_count uncommitted changes in git."
    fi

    # 5. Check claude CLI is available
    if ! command -v claude &> /dev/null; then
        log "PREFLIGHT FAIL: 'claude' CLI not found in PATH."
        errors=$((errors + 1))
    fi

    # 6. Check build passes (skippable)
    if [ "$SKIP_BUILD_CHECK" != "true" ]; then
        log "PREFLIGHT: Verifying build passes..."
        if ! (cd "$PROJECT_DIR" && npm run build > /dev/null 2>&1); then
            log "PREFLIGHT FAIL: 'npm run build' fails. Fix before starting."
            errors=$((errors + 1))
        else
            log "PREFLIGHT: Build OK"
        fi
    else
        log "PREFLIGHT: Build check skipped."
    fi

    if [ "$errors" -gt 0 ]; then
        log "PREFLIGHT: $errors error(s) found. Aborting."
        return 1
    fi

    log "PREFLIGHT: All checks passed."
    return 0
}
