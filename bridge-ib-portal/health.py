"""
Bridge health reporting — upserts a singleton row in bridge_health table.
"""

import logging
from datetime import datetime, timezone
from config import BRIDGE_VERSION

log = logging.getLogger('bridge.health')


def update_health(
    supabase,
    accounts_synced: int,
    accounts_failed: int,
    cycle_duration_ms: int,
    total_cycles: int,
    status: str = 'running',
    error_message: str | None = None
):
    """Upsert the bridge_health singleton row with current metrics."""
    now = datetime.now(timezone.utc).isoformat()
    supabase.table('bridge_health').upsert({
        'id': 'singleton',
        'last_heartbeat': now,
        'status': status,
        'accounts_synced': accounts_synced,
        'accounts_failed': accounts_failed,
        'cycle_duration_ms': cycle_duration_ms,
        'total_cycles': total_cycles,
        'error_message': error_message,
        'version': BRIDGE_VERSION,
        'updated_at': now
    }, on_conflict='id').execute()
    log.debug(f"Health updated: status={status}, synced={accounts_synced}, failed={accounts_failed}")
