"""
IB Portal MT5 Bridge Service v2.0

Key improvements over v1:
  - Structured logging with rotation
  - Parallel sync via ThreadPoolExecutor
  - Incremental deal fetch (since last_synced_at)
  - Upsert open positions (no delete-reinsert gap)
  - Partial close / multi-exit deal support
  - Dynamic point size from MT5 symbol_info
  - Enhanced symbol normalization
  - Retry logic for MT5 and Supabase calls
  - Per-account failure backoff
  - Graceful shutdown on SIGINT/SIGTERM
  - Health heartbeat reporting
"""

import MetaTrader5 as mt5
import signal
import time
import threading
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import (
    SYNC_INTERVAL, SERVER_OFFSET, TRADE_START,
    EQUITY_INTERVAL_MINUTES, CHART_CONTEXT_TIMEFRAME, CHART_CONTEXT_PADDING_MINUTES,
    MAX_WORKERS, CONSECUTIVE_FAIL_THRESHOLD, CONSECUTIVE_FAIL_SKIP_CYCLES,
    BRIDGE_VERSION, CYCLE_TIME_ALERT_THRESHOLD,
    validate_env, setup_logging, mask_account_id,
)
from core import (
    supabase, init_mt5, send_telegram_message, decrypt_password,
    retry_mt5, retry_supabase, TELEGRAM_ADMIN_CHAT_ID,
)
from stats import close_trade_dates_from_rows, recompute_daily_stats_for_account
from health import update_health

log = logging.getLogger('bridge.main')

# --- Graceful shutdown ---
_shutdown_event = threading.Event()


def _signal_handler(signum, frame):
    sig_name = signal.Signals(signum).name
    log.info(f"Received {sig_name} — shutting down gracefully after current work...")
    _shutdown_event.set()


# --- Symbol normalization ---
SYMBOL_MAP = {'GOLD': 'XAUUSD', 'SILVER': 'XAGUSD'}
SYMBOL_SUFFIXES = ['micro', '.raw', '.std', '.pro', 'pro', '#', 'm']


def normalize_symbol(symbol):
    s = symbol.upper()
    for suffix in SYMBOL_SUFFIXES:
        if s.endswith(suffix.upper()):
            s = s[:-len(suffix)]
            break
    return SYMBOL_MAP.get(s, s)


# --- Pip size ---
# MT5 "point" is the smallest price tick (e.g. 0.00001 for EURUSD, 0.001 for XAUUSD).
# A "pip" is the standard unit traders use:
#   - Forex (5-digit): pip = point × 10      (0.0001)
#   - JPY pairs:       pip = point × 10      (0.01)
#   - XAUUSD (3-digit): pip = point × 10     (0.01)
#   - XAGUSD:          pip = point × 10      (0.001)
# Tradezella and industry standard use pip, not point.

# Symbols where 1 pip = 0.01 (metals, JPY pairs)
_PIP_001 = {'XAUUSD', 'GOLD'}
# Symbols where 1 pip = 0.001
_PIP_0001 = {'XAGUSD', 'SILVER'}


def get_pip_size(symbol):
    """Get standard pip size for a symbol, converting MT5 point → pip."""
    normalized = normalize_symbol(symbol)

    # Use known pip sizes for non-standard instruments
    if normalized in _PIP_001 or 'JPY' in normalized:
        return 0.01
    if normalized in _PIP_0001:
        return 0.001

    # Standard forex: pip = 0.0001
    return 0.0001


# --- Helpers ---
def _parse_iso_datetime(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


def _format_chart_bars(rates):
    bars = []
    for rate in rates or []:
        if isinstance(rate, dict):
            raw = rate
        elif hasattr(rate, 'dtype') and getattr(rate.dtype, 'names', None):
            raw = {name: rate[name] for name in rate.dtype.names}
        else:
            raw = {
                'time': getattr(rate, 'time', None),
                'open': getattr(rate, 'open', None),
                'high': getattr(rate, 'high', None),
                'low': getattr(rate, 'low', None),
                'close': getattr(rate, 'close', None),
            }

        if raw.get('time') is None:
            continue
        bars.append({
            'time': int(raw['time']),
            'open': float(raw['open']),
            'high': float(raw['high']),
            'low': float(raw['low']),
            'close': float(raw['close'])
        })
    return bars


def build_trade_chart_context_rows(mt5_module, trade_rows):
    timeframe = getattr(mt5_module, 'TIMEFRAME_M5', None)
    copy_rates_range = getattr(mt5_module, 'copy_rates_range', None)
    if timeframe is None or copy_rates_range is None:
        return []

    rows = []
    for trade in trade_rows:
        open_time = _parse_iso_datetime(trade['open_time'])
        close_time = _parse_iso_datetime(trade['close_time'])
        window_start = open_time - timedelta(minutes=CHART_CONTEXT_PADDING_MINUTES)
        window_end = close_time + timedelta(minutes=CHART_CONTEXT_PADDING_MINUTES)

        server_window_start = window_start + timedelta(seconds=SERVER_OFFSET)
        server_window_end = window_end + timedelta(seconds=SERVER_OFFSET)
        rates = copy_rates_range(
            normalize_symbol(trade['symbol']),
            timeframe,
            server_window_start,
            server_window_end
        )
        bars = _format_chart_bars(rates)
        if not bars:
            continue

        rows.append({
            'trade_id': trade['id'],
            'symbol': normalize_symbol(trade['symbol']),
            'timeframe': CHART_CONTEXT_TIMEFRAME,
            'window_start': window_start.isoformat(),
            'window_end': window_end.isoformat(),
            'bars': bars,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })

    return rows


# --- MT5 global lock (MT5 Python is NOT thread-safe) ---
_mt5_lock = threading.Lock()

# --- Per-account failure tracking ---
_account_failures = {}  # account_id -> {'consecutive': int, 'skip_until_cycle': int}
_cycle_count = 0


def _should_skip_account(account_id):
    """Check if account should be skipped due to consecutive failures."""
    info = _account_failures.get(account_id)
    if not info:
        return False
    if info['consecutive'] >= CONSECUTIVE_FAIL_THRESHOLD and _cycle_count < info['skip_until_cycle']:
        return True
    return False


def _record_failure(account_id):
    info = _account_failures.setdefault(account_id, {'consecutive': 0, 'skip_until_cycle': 0})
    info['consecutive'] += 1
    if info['consecutive'] >= CONSECUTIVE_FAIL_THRESHOLD:
        info['skip_until_cycle'] = _cycle_count + CONSECUTIVE_FAIL_SKIP_CYCLES
        log.warning(
            f"Account {mask_account_id(account_id)} failed {info['consecutive']} times consecutively, "
            f"skipping next {CONSECUTIVE_FAIL_SKIP_CYCLES} cycles"
        )


def _record_success(account_id):
    if account_id in _account_failures:
        del _account_failures[account_id]


# --- Account fetching ---
def get_approved_accounts():
    """Fetch only approved client accounts."""
    response = supabase.table('client_accounts') \
        .select('id, client_name, mt5_account_id, mt5_investor_password, mt5_server, master_ib_id, sync_count, last_synced_at, sync_requested_at') \
        .eq('status', 'approved') \
        .execute()
    return response.data or []


# --- Validation queue ---
def check_validation_queue():
    """Validate pending accounts that haven't been checked yet."""
    response = supabase.table('client_accounts') \
        .select('id, client_name, mt5_account_id, mt5_investor_password, mt5_server, master_ib_id') \
        .eq('status', 'pending') \
        .eq('mt5_validated', False) \
        .execute()

    accounts = response.data or []
    validated = 0
    failed = 0

    for account in accounts:
        if _shutdown_event.is_set():
            break
        try:
            authorized = mt5.login(
                int(account['mt5_account_id']),
                password=decrypt_password(account['mt5_investor_password']),
                server=account['mt5_server']
            )

            now = datetime.now(timezone.utc).isoformat()

            if authorized:
                supabase.table('client_accounts').update({
                    'mt5_validated': True,
                    'mt5_validation_error': None,
                    'last_validated_at': now
                }).eq('id', account['id']).execute()
                validated += 1
                log.info(f"MT5 validated: {account['client_name']} ({mask_account_id(account['mt5_account_id'])})")

                # Notify admins
                admins = supabase.table('profiles').select('id').eq('role', 'admin').execute()
                for admin in (admins.data or []):
                    supabase.table('notifications').insert({
                        'user_id': admin['id'],
                        'type': 'mt5_validated',
                        'title': f'MT5 Validated: {account["client_name"]}',
                        'body': f'Account {account["mt5_account_id"]} on {account["mt5_server"]}'
                    }).execute()

                send_telegram_message(
                    TELEGRAM_ADMIN_CHAT_ID,
                    f"<b>MT5 Validated</b>\n{account['client_name']}\nAccount: {account['mt5_account_id']} @ {account['mt5_server']}"
                )
            else:
                error_code, error_msg = mt5.last_error()
                error_text = f"MT5 Error {error_code}: {error_msg}"

                supabase.table('client_accounts').update({
                    'mt5_validated': False,
                    'mt5_validation_error': error_text,
                    'last_validated_at': now
                }).eq('id', account['id']).execute()
                failed += 1
                log.warning(f"MT5 validation failed: {account['client_name']} — {error_text}")

                # Notify IB
                ib = supabase.table('master_ibs').select('user_id').eq('id', account['master_ib_id']).execute()
                if ib.data:
                    ib_user_id = ib.data[0]['user_id']
                    supabase.table('notifications').insert({
                        'user_id': ib_user_id,
                        'type': 'mt5_validation_failed',
                        'title': f'MT5 ไม่ถูกต้อง: {account["client_name"]}',
                        'body': error_text
                    }).execute()

                    ib_profile = supabase.table('profiles').select('telegram_chat_id').eq('id', ib_user_id).execute()
                    if ib_profile.data and ib_profile.data[0].get('telegram_chat_id'):
                        send_telegram_message(
                            ib_profile.data[0]['telegram_chat_id'],
                            f"<b>MT5 Validation Failed</b>\n{account['client_name']}\n{error_text}"
                        )

                send_telegram_message(
                    TELEGRAM_ADMIN_CHAT_ID,
                    f"<b>MT5 Validation Failed</b>\n{account['client_name']}\n{error_text}"
                )

        except Exception as e:
            supabase.table('client_accounts').update({
                'mt5_validated': False,
                'mt5_validation_error': str(e),
                'last_validated_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', account['id']).execute()
            failed += 1
            log.error(f"Validation exception for {account['client_name']}: {e}")

    return validated, failed


# --- Main sync ---
def sync_client_account(account):
    """Sync a single client account from MT5 to Supabase."""
    account_id = account['id']
    mt5_id = int(account['mt5_account_id'])
    masked_id = mask_account_id(account['mt5_account_id'])

    try:
        # MT5 is NOT thread-safe — acquire lock for all MT5 calls
        with _mt5_lock:
            authorized = retry_mt5(
                mt5.login,
                mt5_id,
                decrypt_password(account['mt5_investor_password']),
                account['mt5_server']
            )
            if not authorized:
                error_msg = f"Login failed: {mt5.last_error()}"
                supabase.table('client_accounts').update({
                    'sync_error': error_msg,
                    'last_synced_at': datetime.now(timezone.utc).isoformat()
                }).eq('id', account_id).execute()
                log.warning(f"[{masked_id}] {error_msg}")
                _record_failure(account_id)
                return False

            info = mt5.account_info()
            if not info:
                supabase.table('client_accounts').update({
                    'sync_error': 'account_info() returned None',
                    'last_synced_at': datetime.now(timezone.utc).isoformat()
                }).eq('id', account_id).execute()
                log.warning(f"[{masked_id}] account_info() returned None")
                _record_failure(account_id)
                return False

            now = datetime.now(timezone.utc)

            # 2. Open positions
            positions = mt5.positions_get()

            # 3. Closed trades — incremental fetch
            last_synced = account.get('last_synced_at')
            if last_synced:
                fetch_from = _parse_iso_datetime(last_synced) - timedelta(days=1)
            else:
                fetch_from = TRADE_START

            fetch_to = datetime.now(timezone.utc)
            _from = fetch_from.replace(tzinfo=timezone.utc) if fetch_from.tzinfo is None else fetch_from
            _to = fetch_to + timedelta(days=1)
            deals = mt5.history_deals_get(_from, _to)
            log.info(f"[{masked_id}] history_deals_get({fetch_from.date()} -> {fetch_to.date()}): {len(deals) if deals is not None else 'None'} deals, last_error={mt5.last_error()}")
        # --- MT5 lock released — Supabase operations below ---

        # 1. Equity snapshot (every N minutes)
        minute = now.minute
        if minute % EQUITY_INTERVAL_MINUTES < 2:
            timestamp = now.replace(
                minute=(minute // EQUITY_INTERVAL_MINUTES) * EQUITY_INTERVAL_MINUTES,
                second=0, microsecond=0
            )
            retry_supabase(
                lambda: supabase.table('equity_snapshots').upsert({
                    'client_account_id': account_id,
                    'timestamp': timestamp.isoformat(),
                    'balance': info.balance,
                    'equity': info.equity,
                    'floating_pl': info.equity - info.balance,
                    'margin_level': info.margin_level if info.margin_level else None
                }, on_conflict='client_account_id,timestamp').execute(),
                description=f"equity_snapshot [{masked_id}]"
            )

        # 2. Open positions — upsert + cleanup stale
        current_tickets = set()
        if positions:
            rows = []
            for pos in positions:
                symbol = normalize_symbol(pos.symbol)
                current_tickets.add(pos.ticket)
                rows.append({
                    'client_account_id': account_id,
                    'position_id': pos.ticket,
                    'symbol': symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'lot_size': pos.volume,
                    'open_price': pos.price_open,
                    'open_time': datetime.fromtimestamp(pos.time - SERVER_OFFSET, tz=timezone.utc).isoformat(),
                    'current_price': pos.price_current,
                    'current_profit': pos.profit,
                    'sl': pos.sl if pos.sl != 0 else None,
                    'tp': pos.tp if pos.tp != 0 else None,
                    'updated_at': now.isoformat()
                })
            if rows:
                retry_supabase(
                    lambda: supabase.table('open_positions').upsert(
                        rows, on_conflict='client_account_id,position_id'
                    ).execute(),
                    description=f"open_positions upsert [{masked_id}]"
                )

        # Delete stale positions (closed since last sync)
        existing_resp = supabase.table('open_positions') \
            .select('position_id') \
            .eq('client_account_id', account_id) \
            .execute()
        existing_ids = {row['position_id'] for row in (existing_resp.data or [])}
        stale_ids = existing_ids - current_tickets
        if stale_ids:
            for stale_id in stale_ids:
                supabase.table('open_positions') \
                    .delete() \
                    .eq('client_account_id', account_id) \
                    .eq('position_id', stale_id) \
                    .execute()
            log.debug(f"[{masked_id}] Cleaned {len(stale_ids)} stale positions")

        trades_to_upsert = []
        if deals:
            position_deals = defaultdict(list)
            for deal in deals:
                if deal.entry in [0, 1]:
                    position_deals[deal.position_id].append(deal)

            for pos_id, pos_deals in position_deals.items():
                entry = next((d for d in pos_deals if d.entry == 0), None)
                exits = [d for d in pos_deals if d.entry == 1]
                if not entry or not exits:
                    continue

                symbol = normalize_symbol(entry.symbol)
                trade_type = 'BUY' if entry.type == 0 else 'SELL'

                pip_size = get_pip_size(symbol)

                # Weighted average close price for partial closes
                total_exit_volume = sum(d.volume for d in exits)
                if total_exit_volume > 0:
                    close_price = sum(d.price * d.volume for d in exits) / total_exit_volume
                else:
                    close_price = exits[0].price

                total_profit = sum(d.profit for d in exits)
                total_commission = sum(getattr(d, 'commission', 0) or 0 for d in pos_deals)
                total_swap = sum(getattr(d, 'swap', 0) or 0 for d in pos_deals)

                if trade_type == 'BUY':
                    pips = (close_price - entry.price) / pip_size
                else:
                    pips = (entry.price - close_price) / pip_size

                trades_to_upsert.append({
                    'client_account_id': account_id,
                    'symbol': symbol,
                    'type': trade_type,
                    'lot_size': entry.volume,
                    'open_price': entry.price,
                    'close_price': round(close_price, 5),
                    'open_time': datetime.fromtimestamp(entry.time - SERVER_OFFSET, tz=timezone.utc).isoformat(),
                    'close_time': datetime.fromtimestamp(exits[-1].time - SERVER_OFFSET, tz=timezone.utc).isoformat(),
                    'profit': total_profit,
                    'commission': round(total_commission, 2),
                    'swap': round(total_swap, 2),
                    'sl': None, 'tp': None,
                    'position_id': pos_id,
                    'pips': round(pips, 1)
                })

            log.info(f"[{masked_id}] trades_to_upsert: {len(trades_to_upsert)}")
            if trades_to_upsert:
                retry_supabase(
                    lambda: supabase.table('trades').upsert(
                        trades_to_upsert,
                        on_conflict='client_account_id,position_id'
                    ).execute(),
                    description=f"trades upsert [{masked_id}]"
                )

                synced_positions = {trade['position_id'] for trade in trades_to_upsert}
                existing_trades = supabase.table('trades') \
                    .select('id, position_id, symbol, open_time, close_time') \
                    .eq('client_account_id', account_id) \
                    .execute()
                chart_context_rows = build_trade_chart_context_rows(
                    mt5,
                    [
                        trade for trade in (existing_trades.data or [])
                        if trade.get('position_id') in synced_positions
                    ]
                )
                if chart_context_rows:
                    retry_supabase(
                        lambda: supabase.table('trade_chart_context').upsert(
                            chart_context_rows,
                            on_conflict='trade_id,timeframe'
                        ).execute(),
                        description=f"chart_context [{masked_id}]"
                    )

        # 4. Daily stats
        touched_dates = close_trade_dates_from_rows(trades_to_upsert)
        touched_dates.add(now.date())
        recompute_daily_stats_for_account(
            supabase=supabase,
            account_id=account_id,
            touched_dates=touched_dates,
            current_state={
                'timestamp': now.isoformat(),
                'balance': info.balance,
                'equity': info.equity,
                'floating_pl': info.equity - info.balance,
                'margin_level': info.margin_level if info.margin_level else None
            }
        )

        # 5. Update sync status
        supabase.table('client_accounts').update({
            'last_synced_at': now.isoformat(),
            'sync_error': None,
            'sync_count': (account.get('sync_count') or 0) + 1,
            'sync_requested_at': None
        }).eq('id', account_id).execute()

        _record_success(account_id)
        log.debug(f"[{masked_id}] Sync complete — {len(trades_to_upsert)} trades, {len(current_tickets)} positions")
        return True

    except Exception as e:
        log.error(f"[{masked_id}] Sync error: {e}")
        try:
            supabase.table('client_accounts').update({
                'sync_error': str(e),
                'last_synced_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', account_id).execute()
        except Exception:
            pass
        _record_failure(account_id)
        return False


# --- Main loop ---
def main():
    global _cycle_count

    validate_env()
    logger = setup_logging()
    log.info(f"IB Portal Bridge v{BRIDGE_VERSION} starting...")

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    if not init_mt5():
        log.error("MT5 initialization failed — exiting")
        return

    log.info(f"Sync interval: {SYNC_INTERVAL}s, Max workers: {MAX_WORKERS}")

    # Notify restart
    send_telegram_message(
        TELEGRAM_ADMIN_CHAT_ID,
        f"<b>Bridge Started</b>\nVersion: {BRIDGE_VERSION}\nSync interval: {SYNC_INTERVAL}s"
    )

    while not _shutdown_event.is_set():
        _cycle_count += 1
        start_time = time.time()
        log.info(f"--- Sync cycle #{_cycle_count} ---")

        ok = 0
        err = 0
        skipped = 0

        try:
            # 1. Validate pending accounts
            if not _shutdown_event.is_set():
                validated, failed = check_validation_queue()
                if validated or failed:
                    log.info(f"Validation: {validated} ok, {failed} failed")

            # 2. Sync approved accounts (parallel)
            if not _shutdown_event.is_set():
                accounts = get_approved_accounts()
                accounts_to_sync = []
                for acc in accounts:
                    if _should_skip_account(acc['id']):
                        skipped += 1
                    else:
                        accounts_to_sync.append(acc)

                if skipped:
                    log.info(f"Skipping {skipped} accounts (consecutive failures)")

                # Prioritize accounts with a pending manual sync request
                accounts_to_sync.sort(key=lambda a: a.get('sync_requested_at') is None)

                log.info(f"Syncing {len(accounts_to_sync)} accounts (workers={MAX_WORKERS})...")

                with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                    futures = {
                        executor.submit(sync_client_account, acc): acc
                        for acc in accounts_to_sync
                    }
                    for future in as_completed(futures):
                        if _shutdown_event.is_set():
                            break
                        try:
                            if future.result():
                                ok += 1
                            else:
                                err += 1
                        except Exception as e:
                            err += 1
                            acc = futures[future]
                            log.error(f"Unhandled error syncing {acc['client_name']}: {e}")

        except Exception as e:
            log.error(f"Cycle error: {e}")

        elapsed = time.time() - start_time
        elapsed_ms = int(elapsed * 1000)
        log.info(f"Cycle #{_cycle_count} done: {ok} ok, {err} errors, {skipped} skipped ({elapsed:.1f}s)")

        # Health heartbeat
        try:
            update_health(
                supabase=supabase,
                accounts_synced=ok,
                accounts_failed=err,
                cycle_duration_ms=elapsed_ms,
                total_cycles=_cycle_count,
                error_message=None if err == 0 else f"{err} account(s) failed"
            )
        except Exception as e:
            log.warning(f"Health update failed: {e}")

        # Alert if cycle too slow
        if elapsed > CYCLE_TIME_ALERT_THRESHOLD:
            send_telegram_message(
                TELEGRAM_ADMIN_CHAT_ID,
                f"<b>Bridge Slow Cycle</b>\nCycle #{_cycle_count}: {elapsed:.1f}s (threshold: {CYCLE_TIME_ALERT_THRESHOLD}s)"
            )

        # Sleep until next cycle (interruptible)
        sleep_time = max(0, SYNC_INTERVAL - elapsed)
        _shutdown_event.wait(timeout=sleep_time)

    log.info("Bridge shutdown complete")
    send_telegram_message(
        TELEGRAM_ADMIN_CHAT_ID,
        f"<b>Bridge Stopped</b>\nVersion: {BRIDGE_VERSION}\nTotal cycles: {_cycle_count}"
    )

    # Update health status to stopped
    try:
        update_health(
            supabase=supabase,
            accounts_synced=0,
            accounts_failed=0,
            cycle_duration_ms=0,
            total_cycles=_cycle_count,
            status='stopped'
        )
    except Exception:
        pass


if __name__ == '__main__':
    main()
