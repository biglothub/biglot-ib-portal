#!/bin/bash
# Dev server lifecycle management

DEV_SERVER_PID=""
DEV_SERVER_PORT=5173
DEV_SERVER_LOG="$PROJECT_DIR/.dev-server.log"

VERIFY_ROUTES=(
  "/portfolio"
  "/portfolio/trades"
  "/portfolio/analytics"
  "/portfolio/day-view"
  "/portfolio/journal"
  "/portfolio/notebook"
  "/portfolio/playbook"
  "/portfolio/progress"
  "/portfolio/calendar"
  "/settings"
  "/settings/security"
  "/settings/trade"
)

start_dev_server() {
    if is_dev_server_running; then
        log "Dev server already running on :$DEV_SERVER_PORT"
        return 0
    fi

    log "Starting dev server on :$DEV_SERVER_PORT..."
    cd "$PROJECT_DIR"
    npm run dev > "$DEV_SERVER_LOG" 2>&1 &
    DEV_SERVER_PID=$!
    echo "$DEV_SERVER_PID" > "$PROJECT_DIR/.dev-server.pid"

    # Wait for server to be ready (max 30s)
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DEV_SERVER_PORT" 2>/dev/null | grep -qE "^(200|302|303|307)$"; then
            log "Dev server ready (PID $DEV_SERVER_PID)"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
    done

    log "WARNING: Dev server did not respond within 30s"
    return 1
}

stop_dev_server() {
    if [ -n "$DEV_SERVER_PID" ]; then
        kill "$DEV_SERVER_PID" 2>/dev/null
        wait "$DEV_SERVER_PID" 2>/dev/null
        log "Dev server stopped"
    elif [ -f "$PROJECT_DIR/.dev-server.pid" ]; then
        local pid
        pid=$(cat "$PROJECT_DIR/.dev-server.pid" 2>/dev/null)
        kill "$pid" 2>/dev/null
    fi
    rm -f "$PROJECT_DIR/.dev-server.pid"
    DEV_SERVER_PID=""
}

is_dev_server_running() {
    if [ -n "$DEV_SERVER_PID" ] && kill -0 "$DEV_SERVER_PID" 2>/dev/null; then
        return 0
    fi
    # Check by port
    if curl -s -o /dev/null "http://localhost:$DEV_SERVER_PORT" 2>/dev/null; then
        return 0
    fi
    return 1
}

restart_dev_server() {
    log "Restarting dev server..."
    stop_dev_server
    sleep 2
    start_dev_server
}

verify_pages() {
    local failed=0
    local passed=0
    local results=""

    for route in "${VERIFY_ROUTES[@]}"; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DEV_SERVER_PORT$route" 2>/dev/null)

        if echo "$status" | grep -qE "^(200|302|303|307)$"; then
            passed=$((passed + 1))
        else
            failed=$((failed + 1))
            results="$results\n  FAIL: $route ($status)"
        fi
    done

    if [ $failed -gt 0 ]; then
        log "Page verification: $passed passed, $failed failed"
        log "$results"
        return 1
    else
        log "Page verification: all $passed routes OK"
        return 0
    fi
}
