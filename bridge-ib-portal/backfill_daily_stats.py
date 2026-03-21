"""
One-time rebuild for daily_stats using existing trades and equity snapshots.

Usage:
  python backfill_daily_stats.py
"""

import logging
from datetime import datetime, timezone

from config import validate_env, setup_logging
from core import supabase
from stats import recompute_daily_stats_for_account

log = logging.getLogger('bridge.backfill')


def main():
    validate_env()
    setup_logging()

    started_at = datetime.now(timezone.utc)
    log.info(f"Backfill daily_stats started at {started_at.isoformat()}")

    response = supabase.table('client_accounts').select('id, client_name').execute()
    accounts = response.data or []

    rebuilt = 0
    failed = 0

    for account in accounts:
        try:
            row_count = recompute_daily_stats_for_account(
                supabase=supabase,
                account_id=account['id'],
                replace_existing=True
            )
            rebuilt += 1
            log.info(f"  {account['client_name']}: rebuilt {row_count} daily rows")
        except Exception as exc:
            failed += 1
            log.error(f"  Failed {account['client_name']}: {exc}")

    finished_at = datetime.now(timezone.utc)
    log.info(
        f"Backfill complete at {finished_at.isoformat()} "
        f"(rebuilt={rebuilt}, failed={failed})"
    )


if __name__ == '__main__':
    main()
