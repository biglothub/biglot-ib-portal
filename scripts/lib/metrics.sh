#!/bin/bash
# Metrics tracking helpers

METRICS_FILE="$PROJECT_DIR/.dev-metrics.json"

init_metrics() {
    if [ ! -f "$METRICS_FILE" ]; then
        cat > "$METRICS_FILE" << 'JSONEOF'
{
  "total_completed": 0,
  "total_failed": 0,
  "build_completed": 0,
  "qa_completed": 0,
  "polish_completed": 0,
  "page_verify_failures": 0,
  "current_streak": 0,
  "best_streak": 0,
  "tasks": []
}
JSONEOF
    fi
}

record_task() {
    local task_id="$1"
    local phase="$2"
    local status="$3"  # success|failure
    local duration="$4" # seconds
    local page_ok="$5"  # true|false

    # Read current values
    local total_completed total_failed current_streak best_streak
    total_completed=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('total_completed',0))")
    total_failed=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('total_failed',0))")
    current_streak=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('current_streak',0))")
    best_streak=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('best_streak',0))")

    if [ "$status" = "success" ]; then
        total_completed=$((total_completed + 1))
        current_streak=$((current_streak + 1))
        if [ "$current_streak" -gt "$best_streak" ]; then
            best_streak=$current_streak
        fi
    else
        total_failed=$((total_failed + 1))
        current_streak=0
    fi

    local page_failures
    page_failures=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('page_verify_failures',0))")
    if [ "$page_ok" = "false" ]; then
        page_failures=$((page_failures + 1))
    fi

    # Phase counters
    local phase_key="${phase}_completed"
    local phase_count
    phase_count=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(d.get('${phase_key}',0))")
    if [ "$status" = "success" ]; then
        phase_count=$((phase_count + 1))
    fi

    # Write updated metrics
    python3 -c "
import json, datetime
d = json.load(open('$METRICS_FILE'))
d['total_completed'] = $total_completed
d['total_failed'] = $total_failed
d['current_streak'] = $current_streak
d['best_streak'] = $best_streak
d['page_verify_failures'] = $page_failures
d['${phase_key}'] = $phase_count
d['tasks'].append({
    'id': '$task_id',
    'phase': '$phase',
    'status': '$status',
    'duration_s': $duration,
    'page_ok': $page_ok == 'true',
    'timestamp': datetime.datetime.now().isoformat()
})
json.dump(d, open('$METRICS_FILE', 'w'), indent=2)
"
}

print_metrics_summary() {
    python3 -c "
import json
d = json.load(open('$METRICS_FILE'))
tasks = d.get('tasks', [])
total = d['total_completed'] + d['total_failed']
avg_dur = sum(t.get('duration_s',0) for t in tasks) / max(len(tasks),1)
print(f\"  Completed: {d['total_completed']} | Failed: {d['total_failed']}\")
print(f\"  Streak: {d['current_streak']} (best: {d['best_streak']})\")
print(f\"  Avg duration: {avg_dur:.0f}s\")
print(f\"  BUILD: {d.get('build_completed',0)} | QA: {d.get('qa_completed',0)} | POLISH: {d.get('polish_completed',0)}\")
print(f\"  Page failures: {d.get('page_verify_failures',0)}\")
" 2>/dev/null || echo "  (metrics unavailable)"
}
