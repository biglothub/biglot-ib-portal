#!/bin/bash
# ===========================================
# Auto-Dev Dashboard — Pretty-print pipeline status
# ===========================================
# Usage: ./scripts/dashboard.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
METRICS_FILE="$PROJECT_DIR/.dev-metrics.json"

if [ ! -f "$METRICS_FILE" ]; then
    echo "No metrics found. Run the orchestrator first."
    exit 1
fi

echo ""
echo "============================================"
echo "  AUTO-DEV DASHBOARD"
echo "============================================"
echo ""

# Summary
jq -r '
    "  Tasks:      \(.total_completed) completed / \(.total_failed) failed",
    "  Streak:     \(.current_streak) current / \(.best_streak) best",
    "",
    "  By Phase:",
    "    BUILD:    \(.build_completed // 0)",
    "    QA:       \(.qa_completed // 0)",
    "    POLISH:   \(.polish_completed // 0)",
    "",
    "  Page Failures: \(.page_verify_failures // 0)"
' "$METRICS_FILE"

echo ""
echo "--------------------------------------------"
echo "  Recent Tasks (last 10)"
echo "--------------------------------------------"
printf "  %-16s %-8s %-9s %s\n" "ID" "Phase" "Status" "Duration"
printf "  %-16s %-8s %-9s %s\n" "---" "-----" "------" "--------"

jq -r '
    .tasks[-10:] | reverse[] |
    "  \(.id)\t\(.phase)\t\(.status)\t\(.duration_s)s"
' "$METRICS_FILE" 2>/dev/null | while IFS=$'\t' read -r id phase status dur; do
    printf "  %-16s %-8s %-9s %s\n" "$id" "$phase" "$status" "$dur"
done

echo ""
echo "--------------------------------------------"

# Average durations by phase
echo "  Avg Duration by Phase:"
jq -r '
    .tasks | group_by(.phase) | map({
        phase: .[0].phase,
        avg: (map(.duration_s) | add / length | floor),
        count: length
    }) | .[] |
    "    \(.phase): \(.avg)s avg (\(.count) tasks)"
' "$METRICS_FILE" 2>/dev/null

echo ""

# Remaining tasks
remaining=$(grep -c '^\- \[ \]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo 0)
completed=$(grep -c '^\- \[x\]' "$PROJECT_DIR/TASKS.md" 2>/dev/null || echo 0)
echo "  TASKS.md: $completed done, $remaining remaining"

# Running status
if [ -f "$PROJECT_DIR/.auto-dev.lock" ]; then
    pid=$(cat "$PROJECT_DIR/.auto-dev.lock" 2>/dev/null)
    if kill -0 "$pid" 2>/dev/null; then
        echo "  Status:    RUNNING (PID $pid)"
    else
        echo "  Status:    STALE LOCK (PID $pid not found)"
    fi
else
    echo "  Status:    STOPPED"
fi

echo ""
echo "============================================"
