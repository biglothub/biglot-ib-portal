"""
IB Portal MT5 Bridge Service
Adapted from TSP-Competition bridge/main.py

Key changes from TSP:
  - Dynamic account loading from client_accounts WHERE status='approved'
  - Validation queue for pending accounts
  - Error tracking per account (sync_error, last_synced_at)
  - Field mapping: participant_id -> client_account_id
"""

import MetaTrader5 as mt5
import time
import os
from datetime import datetime, timezone
from collections import defaultdict
from dotenv import load_dotenv
from core import supabase, init_mt5, send_telegram_message, decrypt_password, TELEGRAM_ADMIN_CHAT_ID
from stats import close_trade_dates_from_rows, recompute_daily_stats_for_account

load_dotenv()

SYNC_INTERVAL = int(os.getenv('SYNC_INTERVAL', '60'))
SERVER_OFFSET = 10800  # 3 hours (MT5 server time offset)
TRADE_START = datetime(2024, 1, 1, tzinfo=timezone.utc)
EQUITY_INTERVAL_MINUTES = 5


def get_approved_accounts():
    """Fetch only approved client accounts"""
    response = supabase.table('client_accounts') \
        .select('id, client_name, mt5_account_id, mt5_investor_password, mt5_server, master_ib_id, sync_count') \
        .eq('status', 'approved') \
        .execute()
    return response.data or []


def check_validation_queue():
    """Validate pending accounts that haven't been checked yet"""
    response = supabase.table('client_accounts') \
        .select('id, client_name, mt5_account_id, mt5_investor_password, mt5_server, master_ib_id') \
        .eq('status', 'pending') \
        .eq('mt5_validated', False) \
        .execute()

    accounts = response.data or []
    validated = 0
    failed = 0

    for account in accounts:
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

                # Notify admins
                admins = supabase.table('profiles').select('id').eq('role', 'admin').execute()
                for admin in (admins.data or []):
                    supabase.table('notifications').insert({
                        'user_id': admin['id'],
                        'type': 'mt5_validated',
                        'title': f'MT5 Validated: {account["client_name"]}',
                        'body': f'Account {account["mt5_account_id"]} on {account["mt5_server"]}'
                    }).execute()

                # Telegram: notify admin
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

                    # Telegram: notify IB
                    ib_profile = supabase.table('profiles').select('telegram_chat_id').eq('id', ib_user_id).execute()
                    if ib_profile.data and ib_profile.data[0].get('telegram_chat_id'):
                        send_telegram_message(
                            ib_profile.data[0]['telegram_chat_id'],
                            f"<b>MT5 Validation Failed</b>\n{account['client_name']}\n{error_text}"
                        )

                # Telegram: notify admin
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

    return validated, failed


def sync_client_account(account):
    """Sync a single client account (adapted from TSP sync_participant)"""
    account_id = account['id']
    mt5_id = int(account['mt5_account_id'])

    try:
        authorized = mt5.login(
            mt5_id,
            password=decrypt_password(account['mt5_investor_password']),
            server=account['mt5_server']
        )
        if not authorized:
            error_msg = f"Login failed: {mt5.last_error()}"
            supabase.table('client_accounts').update({
                'sync_error': error_msg,
                'last_synced_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', account_id).execute()
            return False

        info = mt5.account_info()
        if not info:
            supabase.table('client_accounts').update({
                'sync_error': 'account_info() returned None',
                'last_synced_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', account_id).execute()
            return False

        # 1. Equity snapshot (every 5 min)
        now = datetime.now(timezone.utc)
        minute = now.minute
        if minute % EQUITY_INTERVAL_MINUTES < 2:
            timestamp = now.replace(
                minute=(minute // EQUITY_INTERVAL_MINUTES) * EQUITY_INTERVAL_MINUTES,
                second=0, microsecond=0
            )
            supabase.table('equity_snapshots').upsert({
                'client_account_id': account_id,
                'timestamp': timestamp.isoformat(),
                'balance': info.balance,
                'equity': info.equity,
                'floating_pl': info.equity - info.balance,
                'margin_level': info.margin_level if info.margin_level else None
            }, on_conflict='client_account_id,timestamp').execute()

        # 2. Open positions
        supabase.table('open_positions').delete().eq('client_account_id', account_id).execute()
        positions = mt5.positions_get()
        if positions:
            rows = []
            for pos in positions:
                symbol = pos.symbol
                if any(g in symbol.upper() for g in ['GOLD', 'XAUUSD']):
                    symbol = 'XAUUSD'
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
                supabase.table('open_positions').insert(rows).execute()

        # 3. Closed trades
        trades_to_upsert = []
        deals = mt5.history_deals_get(TRADE_START, datetime.now())
        if deals:
            position_deals = defaultdict(list)
            for deal in deals:
                if deal.entry in [0, 1]:
                    position_deals[deal.position_id].append(deal)

            for pos_id, pos_deals in position_deals.items():
                entry = next((d for d in pos_deals if d.entry == 0), None)
                exit_deal = next((d for d in pos_deals if d.entry == 1), None)
                if not entry or not exit_deal:
                    continue

                symbol = entry.symbol
                if any(g in symbol.upper() for g in ['GOLD', 'XAUUSD']):
                    symbol = 'XAUUSD'

                trade_type = 'BUY' if entry.type == 0 else 'SELL'
                point_size = 0.01 if ('JPY' in symbol or symbol == 'XAUUSD') else 0.0001
                pips = ((exit_deal.price - entry.price) / point_size) if trade_type == 'BUY' \
                    else ((entry.price - exit_deal.price) / point_size)

                trades_to_upsert.append({
                    'client_account_id': account_id,
                    'symbol': symbol,
                    'type': trade_type,
                    'lot_size': entry.volume,
                    'open_price': entry.price,
                    'close_price': exit_deal.price,
                    'open_time': datetime.fromtimestamp(entry.time - SERVER_OFFSET, tz=timezone.utc).isoformat(),
                    'close_time': datetime.fromtimestamp(exit_deal.time - SERVER_OFFSET, tz=timezone.utc).isoformat(),
                    'profit': exit_deal.profit,
                    'sl': None, 'tp': None,
                    'position_id': pos_id,
                    'pips': round(pips, 1)
                })

            if trades_to_upsert:
                supabase.table('trades').upsert(
                    trades_to_upsert,
                    on_conflict='client_account_id,position_id'
                ).execute()

        # 4. Daily stats (per UTC day, not lifetime summary)
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
            'sync_count': (account.get('sync_count') or 0) + 1
        }).eq('id', account_id).execute()

        return True

    except Exception as e:
        print(f"  Error syncing {account['client_name']}: {e}")
        supabase.table('client_accounts').update({
            'sync_error': str(e),
            'last_synced_at': datetime.now(timezone.utc).isoformat()
        }).eq('id', account_id).execute()
        return False


def main():
    print("IB Portal Bridge starting...")

    if not init_mt5():
        print("MT5 initialization failed")
        return

    print(f"MT5 initialized. Sync interval: {SYNC_INTERVAL}s")

    while True:
        start_time = time.time()
        print(f"\n--- Sync: {datetime.now().strftime('%H:%M:%S')} ---")

        try:
            # 1. Validate pending accounts
            validated, failed = check_validation_queue()
            if validated or failed:
                print(f"  Validation: {validated} ok, {failed} failed")

            # 2. Sync approved accounts
            accounts = get_approved_accounts()
            print(f"  Syncing {len(accounts)} accounts...")

            ok = 0
            err = 0
            for account in accounts:
                if sync_client_account(account):
                    ok += 1
                else:
                    err += 1

            print(f"  Done: {ok} ok, {err} errors")

        except Exception as e:
            print(f"  Cycle error: {e}")

        elapsed = time.time() - start_time
        sleep_time = max(0, SYNC_INTERVAL - elapsed)
        time.sleep(sleep_time)


if __name__ == '__main__':
    main()
