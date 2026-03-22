#!/bin/bash
# Metrics tracking helpers — uses jq for reliable JSON handling

METRICS_FILE="$PROJECT_DIR/.dev-metrics.json"

init_metrics() {
    if [ ! -f "$METRICS_FILE" ]; then
        jq -n '{
            total_completed: 0,
            total_failed: 0,
            build_completed: 0,
            qa_completed: 0,
            polish_completed: 0,
            page_verify_failures: 0,
            current_streak: 0,
            best_streak: 0,
            tasks: []
        }' > "$METRICS_FILE"
    fi
}

record_task() {
    local task_id="$1"
    local phase="$2"
    local task_status="$3"
    local duration="$4"
    local page_ok="$5"
    local build_ok="${6:-unknown}"
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    local tmp
    tmp=$(mktemp)

    jq \
        --arg tid "$task_id" \
        --arg ph "$phase" \
        --arg st "$task_status" \
        --argjson dur "$duration" \
        --arg pok "$page_ok" \
        --arg bok "$build_ok" \
        --arg ts "$now" \
    '
    if $st == "success" then
        .total_completed += 1 |
        .current_streak += 1 |
        .best_streak = ([.best_streak, .current_streak] | max) |
        .[$ph + "_completed"] = ((.[$ph + "_completed"] // 0) + 1)
    else
        .total_failed += 1 |
        .current_streak = 0
    end |
    if $pok == "false" then
        .page_verify_failures = ((.page_verify_failures // 0) + 1)
    else . end |
    .tasks += [{
        id: $tid,
        phase: $ph,
        status: $st,
        duration_s: $dur,
        page_ok: ($pok == "true"),
        build_ok: $bok,
        timestamp: $ts
    }]
    ' "$METRICS_FILE" > "$tmp" && mv "$tmp" "$METRICS_FILE"
}

print_metrics_summary() {
    if [ ! -f "$METRICS_FILE" ]; then
        echo "  (no metrics yet)"
        return
    fi
    jq -r '
        (.tasks | length) as $count |
        (.tasks | map(.duration_s) | if length > 0 then add / length else 0 end) as $avg |
        "  Completed: \(.total_completed) | Failed: \(.total_failed)",
        "  Streak: \(.current_streak) (best: \(.best_streak))",
        "  Avg duration: \($avg | floor)s",
        "  BUILD: \(.build_completed // 0) | QA: \(.qa_completed // 0) | POLISH: \(.polish_completed // 0)",
        "  Page failures: \(.page_verify_failures // 0)"
    ' "$METRICS_FILE" 2>/dev/null || echo "  (metrics unavailable)"
}
