"""
Smart scheduler: decides when each account should be synced next.

Tiers (most-aggressive → least):
  live    — account has open positions (need close-to-realtime P&L)
  active  — recent closed trade in the last ACTIVE_TRADE_WINDOW_HOURS
  normal  — approved account, no recent activity
  idle    — long stretches of no activity
  closed  — forex market closed (weekend)
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from config import (
    TIER_INTERVAL_LIVE, TIER_INTERVAL_ACTIVE, TIER_INTERVAL_NORMAL,
    TIER_INTERVAL_IDLE, TIER_INTERVAL_CLOSED, ACTIVE_TRADE_WINDOW_HOURS,
)


def is_forex_market_closed(now: datetime) -> bool:
    """Forex closes Fri 22:00 UTC, reopens Sun 22:00 UTC.
    Approximate — does not account for holidays.
    """
    weekday = now.weekday()  # Mon=0 ... Sun=6
    if weekday == 5:  # Saturday
        return True
    if weekday == 4 and now.hour >= 22:  # Friday after 22:00 UTC
        return True
    if weekday == 6 and now.hour < 22:   # Sunday before 22:00 UTC
        return True
    return False


def classify_tier(
    has_open_positions: bool,
    last_trade_close: datetime | None,
    now: datetime | None = None
) -> str:
    """Pick a tier based on account activity and current market state."""
    now = now or datetime.now(timezone.utc)

    if is_forex_market_closed(now) and not has_open_positions:
        return 'closed'

    if has_open_positions:
        return 'live'

    if last_trade_close:
        hours_ago = (now - last_trade_close).total_seconds() / 3600
        if hours_ago < ACTIVE_TRADE_WINDOW_HOURS:
            return 'active'
        if hours_ago < 24:
            return 'normal'

    return 'idle'


_TIER_INTERVAL = {
    'live': TIER_INTERVAL_LIVE,
    'active': TIER_INTERVAL_ACTIVE,
    'normal': TIER_INTERVAL_NORMAL,
    'idle': TIER_INTERVAL_IDLE,
    'closed': TIER_INTERVAL_CLOSED,
}


def next_sync_at(tier: str, now: datetime | None = None) -> datetime:
    """When the bridge should pick this account up again."""
    now = now or datetime.now(timezone.utc)
    interval = _TIER_INTERVAL.get(tier, TIER_INTERVAL_NORMAL)
    return now + timedelta(seconds=interval)
