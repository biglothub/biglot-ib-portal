#!/bin/bash
# Auto-restart wrapper for the IB Portal bridge service.
# Usage: bash start.sh
# The script restarts the bridge whenever it exits (crash or KeyboardInterrupt exits with 0 to stop).

cd "$(dirname "$0")"

RESTART_DELAY=5

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting bridge..."
    python main.py
    EXIT_CODE=$?

    # Exit code 0 means intentional stop (Ctrl+C forwarded) — do not restart
    if [ "$EXIT_CODE" -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Bridge stopped cleanly. Exiting."
        break
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Bridge crashed (exit $EXIT_CODE). Restarting in ${RESTART_DELAY}s..."
    sleep "$RESTART_DELAY"
done
