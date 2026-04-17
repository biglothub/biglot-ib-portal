"""
Dead-letter queue: persist persistent sync failures + notify the IB.

Called from main.py when an account crosses the consecutive-fail threshold.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from core import supabase, send_telegram_message, TELEGRAM_ADMIN_CHAT_ID

log = logging.getLogger('bridge.failures')


def record_sync_failure(
    account: dict[str, Any],
    error_message: str,
    consecutive: int,
    error_code: str = 'unknown',
) -> None:
    """Insert a dead-letter row and fire Telegram alerts to IB + admin."""
    account_id = account['id']
    client_name = account.get('client_name') or account.get('mt5_account_id') or account_id

    # Upsert-style: skip if we already have an unresolved failure for this account today.
    try:
        existing = supabase.table('sync_failures') \
            .select('id, consecutive_failures') \
            .eq('client_account_id', account_id) \
            .is_('resolved_at', 'null') \
            .order('failed_at', desc=True) \
            .limit(1) \
            .execute()
    except Exception as e:
        log.warning(f"sync_failures select failed for {client_name}: {e}")
        existing = None

    existing_row = (existing.data[0] if existing and existing.data else None) if existing else None

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        if existing_row:
            # Bump consecutive count on the open failure record.
            supabase.table('sync_failures').update({
                'consecutive_failures': consecutive,
                'error_message': error_message[:500],
                'error_code': error_code,
                'failed_at': now_iso,
            }).eq('id', existing_row['id']).execute()
            already_notified = True  # Don't spam — we notified on the first breach.
        else:
            supabase.table('sync_failures').insert({
                'client_account_id': account_id,
                'error_message': error_message[:500],
                'error_code': error_code,
                'consecutive_failures': consecutive,
                'failed_at': now_iso,
                'ib_notified': False,
                'admin_notified': False,
            }).execute()
            already_notified = False
    except Exception as e:
        log.error(f"Failed to persist sync_failure for {client_name}: {e}")
        return

    if already_notified:
        return

    _notify_ib(account, error_message)
    _notify_admin(account, error_message, consecutive)

    try:
        supabase.table('sync_failures').update({
            'ib_notified': True,
            'admin_notified': True,
        }).eq('client_account_id', account_id).is_('resolved_at', 'null').execute()
    except Exception as e:
        log.warning(f"Could not flag notification state: {e}")


def resolve_sync_failures(account_id: str) -> None:
    """When an account syncs successfully again, close any open failure rows."""
    try:
        supabase.table('sync_failures').update({
            'resolved_at': datetime.now(timezone.utc).isoformat()
        }).eq('client_account_id', account_id).is_('resolved_at', 'null').execute()
    except Exception as e:
        log.warning(f"Could not resolve sync_failures for {account_id}: {e}")


def _notify_ib(account: dict[str, Any], error_message: str) -> None:
    master_ib_id = account.get('master_ib_id')
    if not master_ib_id:
        return

    try:
        ib = supabase.table('master_ibs') \
            .select('user_id') \
            .eq('id', master_ib_id) \
            .limit(1) \
            .execute()
        if not ib.data:
            return
        ib_user_id = ib.data[0]['user_id']

        # Notification row (in-app bell).
        supabase.table('notifications').insert({
            'user_id': ib_user_id,
            'type': 'mt5_sync_failed',
            'title': f'Sync หยุดทำงาน: {account.get("client_name", "บัญชีลูกค้า")}',
            'body': f'ระบบ sync MT5 ล้มเหลวซ้ำหลายครั้ง กรุณาตรวจสอบรหัส investor password\n{error_message[:200]}'
        }).execute()

        # Telegram (if IB has set it up).
        profile = supabase.table('profiles') \
            .select('telegram_chat_id') \
            .eq('id', ib_user_id) \
            .limit(1) \
            .execute()
        chat_id = profile.data[0].get('telegram_chat_id') if profile.data else None
        if chat_id:
            send_telegram_message(
                chat_id,
                (
                    f"<b>⚠️ MT5 Sync Failed</b>\n"
                    f"{account.get('client_name', 'Client')}\n"
                    f"Account: {account.get('mt5_account_id', '?')}\n"
                    f"Error: {error_message[:300]}"
                )
            )
    except Exception as e:
        log.warning(f"IB notify failed: {e}")


def _notify_admin(account: dict[str, Any], error_message: str, consecutive: int) -> None:
    if not TELEGRAM_ADMIN_CHAT_ID:
        return
    send_telegram_message(
        TELEGRAM_ADMIN_CHAT_ID,
        (
            f"<b>🚨 Sync Dead-letter</b>\n"
            f"{account.get('client_name', 'Client')} ({account.get('mt5_account_id', '?')})\n"
            f"Consecutive failures: {consecutive}\n"
            f"Error: {error_message[:300]}"
        )
    )
