#!/bin/bash
# macOS notification helpers for long-running orchestrator sessions

notify() {
    local title="$1"
    local message="$2"
    local sound="${3:-default}"

    # macOS native notification
    if command -v osascript &>/dev/null; then
        osascript -e "display notification \"$message\" with title \"$title\" sound name \"$sound\"" 2>/dev/null
        return
    fi

    # Fallback: terminal bell
    printf '\a'
}

notify_success() {
    local task_id="$1"
    if [ "${NOTIFY_ON_SUCCESS:-false}" = "true" ]; then
        notify "Auto-Dev: Task Complete" "$task_id completed successfully" "Ping"
    fi
}

notify_failure() {
    local task_id="$1"
    local failures="$2"
    if [ "${NOTIFY_ON_FAILURE:-true}" = "true" ] && [ "$failures" -ge 2 ]; then
        notify "Auto-Dev: Task Failed" "$task_id failed ($failures consecutive)" "Basso"
    fi
}

notify_all_done() {
    if [ "${NOTIFY_ON_COMPLETE:-true}" = "true" ]; then
        local completed
        completed=$(count_completed 2>/dev/null || echo "?")
        notify "Auto-Dev: All Tasks Complete" "$completed tasks completed" "Hero"
    fi
}

notify_stopped() {
    local reason="$1"
    if [ "${NOTIFY_ON_COMPLETE:-true}" = "true" ]; then
        notify "Auto-Dev: Stopped" "$reason" "Basso"
    fi
}
