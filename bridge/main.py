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
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from dotenv import load_dotenv
from core import supabase, init_mt5, send_telegram_message, decrypt_password, TELEGRAM_ADMIN_CHAT_ID

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
        deals = mt5.history_deals_get(TRADE_START, datetime.now())
        if deals:
            position_deals = defaultdict(list)
            for deal in deals:
                if deal.entry in [0, 1]:
                    position_deals[deal.position_id].append(deal)

            trades_to_upsert = []
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

        # 4. Daily stats
        today = now.strftime('%Y-%m-%d')
        all_trades_resp = supabase.table('trades') \
            .select('profit, type, symbol, lot_size, open_time, close_time') \
            .eq('client_account_id', account_id).execute()
        all_trades = all_trades_resp.data or []

        total = len(all_trades)
        wins = [t for t in all_trades if t['profit'] > 0]
        losses = [t for t in all_trades if t['profit'] < 0]

        win_rate = (len(wins) / total * 100) if total > 0 else 0
        gross_profit = sum(t['profit'] for t in wins) if wins else 0
        gross_loss = abs(sum(t['profit'] for t in losses)) if losses else 0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0
        avg_win = (gross_profit / len(wins)) if wins else 0
        avg_loss = (gross_loss / len(losses)) if losses else 0
        rr_ratio = (avg_win / avg_loss) if avg_loss > 0 else 0

        # best/worst trade
        best_trade = max((t['profit'] for t in all_trades), default=0)
        worst_trade = min((t['profit'] for t in all_trades), default=0)

        # win rate by type
        buy_trades = [t for t in all_trades if t['type'] == 'BUY']
        sell_trades = [t for t in all_trades if t['type'] == 'SELL']
        win_rate_buy = (sum(1 for t in buy_trades if t['profit'] > 0) / len(buy_trades) * 100) if buy_trades else 0
        win_rate_sell = (sum(1 for t in sell_trades if t['profit'] > 0) / len(sell_trades) * 100) if sell_trades else 0

        # consecutive wins/losses
        max_consec_wins = 0
        max_consec_losses = 0
        cur_wins = 0
        cur_losses = 0
        for t in sorted(all_trades, key=lambda x: x['close_time']):
            if t['profit'] > 0:
                cur_wins += 1
                cur_losses = 0
                max_consec_wins = max(max_consec_wins, cur_wins)
            elif t['profit'] < 0:
                cur_losses += 1
                cur_wins = 0
                max_consec_losses = max(max_consec_losses, cur_losses)
            else:
                cur_wins = 0
                cur_losses = 0

        # total lots
        total_lots = sum(t['lot_size'] for t in all_trades)

        # favorite pair
        symbol_counts = defaultdict(int)
        for t in all_trades:
            symbol_counts[t['symbol']] += 1
        favorite_pair = max(symbol_counts, key=symbol_counts.get) if symbol_counts else None

        # avg holding time
        holding_secs = []
        for t in all_trades:
            try:
                open_dt = datetime.fromisoformat(t['open_time'].replace('Z', '+00:00'))
                close_dt = datetime.fromisoformat(t['close_time'].replace('Z', '+00:00'))
                holding_secs.append((close_dt - open_dt).total_seconds())
            except (ValueError, TypeError):
                pass
        avg_hold = (sum(holding_secs) / len(holding_secs)) if holding_secs else 0

        if avg_hold > 0:
            if avg_hold < 60:
                avg_holding_time = f"{int(avg_hold)}s"
            elif avg_hold < 3600:
                avg_holding_time = f"{int(avg_hold / 60)}m"
            elif avg_hold < 86400:
                avg_holding_time = f"{int(avg_hold / 3600)}h {int((avg_hold % 3600) / 60)}m"
            else:
                avg_holding_time = f"{int(avg_hold / 86400)}d {int((avg_hold % 86400) / 3600)}h"
        else:
            avg_holding_time = None

        # trading style
        if avg_hold > 0:
            if avg_hold < 300:
                trading_style = "Scalper"
            elif avg_hold < 14400:
                trading_style = "Day Trader"
            elif avg_hold < 604800:
                trading_style = "Swing Trader"
            else:
                trading_style = "Position Trader"
        else:
            trading_style = None

        # session stats (Asian 00-08, London 08-16, NY 13-21 UTC)
        session_trades = {'asian': [], 'london': [], 'newyork': []}
        for t in all_trades:
            try:
                hour = datetime.fromisoformat(t['close_time'].replace('Z', '+00:00')).hour
                if 0 <= hour < 8:
                    session_trades['asian'].append(t)
                if 8 <= hour < 16:
                    session_trades['london'].append(t)
                if 13 <= hour < 21:
                    session_trades['newyork'].append(t)
            except (ValueError, TypeError):
                pass

        def calc_session(trades_list):
            if not trades_list:
                return 0, 0
            p = sum(t['profit'] for t in trades_list)
            w = sum(1 for t in trades_list if t['profit'] > 0)
            return round(p, 2), round(w / len(trades_list) * 100, 1)

        asian_profit, asian_wr = calc_session(session_trades['asian'])
        london_profit, london_wr = calc_session(session_trades['london'])
        ny_profit, ny_wr = calc_session(session_trades['newyork'])

        # max drawdown from equity snapshots
        snap_resp = supabase.table('equity_snapshots') \
            .select('equity') \
            .eq('client_account_id', account_id) \
            .order('timestamp', desc=False) \
            .execute()
        equities = [s['equity'] for s in (snap_resp.data or [])]

        max_drawdown = 0
        if equities:
            peak = equities[0]
            for eq in equities:
                if eq > peak:
                    peak = eq
                if peak > 0:
                    dd = ((peak - eq) / peak) * 100
                    if dd > max_drawdown:
                        max_drawdown = dd

        # equity growth percent
        equity_growth = 0
        if equities and equities[0] > 0:
            equity_growth = ((info.equity - equities[0]) / equities[0]) * 100

        supabase.table('daily_stats').upsert({
            'client_account_id': account_id,
            'date': today,
            'balance': info.balance,
            'equity': info.equity,
            'profit': info.profit,
            'floating_pl': info.equity - info.balance,
            'margin_level': info.margin_level if info.margin_level else None,
            'win_rate': round(win_rate, 1),
            'total_trades': total,
            'profit_factor': round(profit_factor, 2),
            'rr_ratio': round(rr_ratio, 2),
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2),
            'peak_equity': max(info.equity, info.balance),
            'best_trade': round(best_trade, 2),
            'worst_trade': round(worst_trade, 2),
            'win_rate_buy': round(win_rate_buy, 1),
            'win_rate_sell': round(win_rate_sell, 1),
            'max_consecutive_wins': max_consec_wins,
            'max_consecutive_losses': max_consec_losses,
            'max_drawdown': round(max_drawdown, 2),
            'total_lots': round(total_lots, 2),
            'favorite_pair': favorite_pair,
            'avg_holding_time': avg_holding_time,
            'trading_style': trading_style,
            'session_asian_profit': asian_profit,
            'session_asian_win_rate': asian_wr,
            'session_london_profit': london_profit,
            'session_london_win_rate': london_wr,
            'session_newyork_profit': ny_profit,
            'session_newyork_win_rate': ny_wr,
            'equity_growth_percent': round(equity_growth, 2),
        }, on_conflict='client_account_id,date').execute()

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
