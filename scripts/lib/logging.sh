#!/bin/bash
# Structured logging helpers + log rotation
# Provides human-readable log + machine-parseable JSONL

JSON_LOGFILE="$PROJECT_DIR/.auto-dev.jsonl"

# Human-readable log (backwards-compatible)
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# Structured JSON log entry (appended as JSONL)
log_json() {
    local event="$1"
    shift
    local json_fields=""
    while [ $# -gt 0 ]; do
        local key="${1%%=*}"
        local val="${1#*=}"
        val=$(echo "$val" | sed 's/"/\\"/g')
        json_fields="$json_fields, \"$key\": \"$val\""
        shift
    done
    echo "{\"ts\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\", \"event\": \"$event\"$json_fields}" >> "$JSON_LOGFILE"
}

# Combined: log human + JSON
log_event() {
    local event="$1"
    local message="$2"
    shift 2
    log "$message"
    log_json "$event" "message=$message" "$@"
}

# Log rotation — call at orchestrator startup
rotate_logs() {
    local max_size="${LOG_MAX_SIZE:-$((10 * 1024 * 1024))}"
    local max_files="${LOG_MAX_FILES:-5}"

    for logfile in "$LOGFILE" "$JSON_LOGFILE" "${DEV_SERVER_LOG:-}"; do
        [ -z "$logfile" ] && continue
        [ ! -f "$logfile" ] && continue

        local size
        size=$(stat -f%z "$logfile" 2>/dev/null || stat --printf=%s "$logfile" 2>/dev/null || echo 0)

        if [ "$size" -gt "$max_size" ]; then
            # Shift existing rotated files (.5 → delete, .4 → .5, ... .1 → .2)
            local i
            for i in $(seq $((max_files - 1)) -1 1); do
                [ -f "${logfile}.$i" ] && mv "${logfile}.$i" "${logfile}.$((i + 1))"
            done
            # Rotate current → .1
            mv "$logfile" "${logfile}.1"
            touch "$logfile"
            log "Log rotated: $logfile (was $size bytes)"
        fi
    done
}
