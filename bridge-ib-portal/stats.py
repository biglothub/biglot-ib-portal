from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable

UTC = timezone.utc
log = logging.getLogger('bridge.stats')


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(UTC)
    except ValueError:
        return None


def close_trade_dates_from_rows(rows: Iterable[dict[str, Any]]) -> set[date]:
    dates: set[date] = set()
    for row in rows:
        close_dt = parse_iso_datetime(row.get('close_time'))
        if close_dt:
            dates.add(close_dt.date())
    return dates


def _prepare_trades(trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    for trade in trades:
        close_dt = parse_iso_datetime(trade.get('close_time'))
        if not close_dt:
            continue
        open_dt = parse_iso_datetime(trade.get('open_time'))
        prepared.append({
            **trade,
            '_close_dt': close_dt,
            '_open_dt': open_dt
        })
    return prepared


def _prepare_snapshots(snapshots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    for snapshot in snapshots:
        timestamp = parse_iso_datetime(snapshot.get('timestamp'))
        if not timestamp:
            continue
        prepared.append({
            **snapshot,
            '_timestamp': timestamp
        })
    prepared.sort(key=lambda item: item['_timestamp'])
    return prepared


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=UTC)
    return start, start + timedelta(days=1)


def _latest_state_before_day_end(
    day: date,
    snapshots: list[dict[str, Any]],
    current_state: dict[str, Any] | None
) -> dict[str, Any] | None:
    _, day_end = _day_bounds(day)
    latest_snapshot = None

    for snapshot in snapshots:
        if snapshot['_timestamp'] < day_end:
            latest_snapshot = snapshot
        else:
            break

    if current_state:
        current_ts = current_state['_timestamp']
        if current_ts.date() == day and (not latest_snapshot or current_ts >= latest_snapshot['_timestamp']):
            return current_state

    return latest_snapshot


def _snapshots_for_day(
    day: date,
    snapshots: list[dict[str, Any]],
    current_state: dict[str, Any] | None
) -> list[dict[str, Any]]:
    start, end = _day_bounds(day)
    items = [snapshot for snapshot in snapshots if start <= snapshot['_timestamp'] < end]

    if current_state and start <= current_state['_timestamp'] < end:
        if not items or current_state['_timestamp'] >= items[-1]['_timestamp']:
            items.append(current_state)

    return items


def _calc_drawdown(equities: list[float]) -> float:
    max_drawdown = 0.0
    if not equities:
        return max_drawdown

    peak = equities[0]
    for equity in equities:
        if equity > peak:
            peak = equity
        if peak > 0:
            drawdown = ((peak - equity) / peak) * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
    return round(max_drawdown, 2)


def _calc_session(trades_list: list[dict[str, Any]]) -> tuple[float, float]:
    if not trades_list:
        return 0.0, 0.0
    profit = sum(float(trade['profit']) for trade in trades_list)
    wins = sum(1 for trade in trades_list if float(trade['profit']) > 0)
    return round(profit, 2), round(wins / len(trades_list) * 100, 1)


def build_daily_stats_row(
    account_id: str,
    day: date,
    trades: list[dict[str, Any]],
    snapshots: list[dict[str, Any]],
    current_state: dict[str, Any] | None = None
) -> dict[str, Any]:
    day_trades = [trade for trade in trades if trade['_close_dt'].date() == day]
    day_trades.sort(key=lambda trade: trade['_close_dt'])

    end_state = _latest_state_before_day_end(day, snapshots, current_state)
    day_snapshots = _snapshots_for_day(day, snapshots, current_state)

    total = len(day_trades)
    wins = [trade for trade in day_trades if float(trade['profit']) > 0]
    losses = [trade for trade in day_trades if float(trade['profit']) < 0]

    gross_profit = sum(float(trade['profit']) for trade in wins) if wins else 0.0
    gross_loss = abs(sum(float(trade['profit']) for trade in losses)) if losses else 0.0
    avg_win = gross_profit / len(wins) if wins else 0.0
    avg_loss = gross_loss / len(losses) if losses else 0.0

    best_trade = max((float(trade['profit']) for trade in day_trades), default=0.0)
    worst_trade = min((float(trade['profit']) for trade in day_trades), default=0.0)

    buy_trades = [trade for trade in day_trades if trade['type'] == 'BUY']
    sell_trades = [trade for trade in day_trades if trade['type'] == 'SELL']

    max_consec_wins = 0
    max_consec_losses = 0
    cur_wins = 0
    cur_losses = 0
    for trade in day_trades:
        profit = float(trade['profit'])
        if profit > 0:
            cur_wins += 1
            cur_losses = 0
            max_consec_wins = max(max_consec_wins, cur_wins)
        elif profit < 0:
            cur_losses += 1
            cur_wins = 0
            max_consec_losses = max(max_consec_losses, cur_losses)
        else:
            cur_wins = 0
            cur_losses = 0

    total_lots = sum(float(trade['lot_size']) for trade in day_trades)
    symbol_counts: defaultdict[str, int] = defaultdict(int)
    for trade in day_trades:
        symbol_counts[str(trade['symbol'])] += 1
    favorite_pair = max(symbol_counts, key=symbol_counts.get) if symbol_counts else None

    holding_secs: list[float] = []
    for trade in day_trades:
        open_dt = trade.get('_open_dt')
        close_dt = trade.get('_close_dt')
        if open_dt and close_dt:
            holding_secs.append((close_dt - open_dt).total_seconds())
    avg_hold = (sum(holding_secs) / len(holding_secs)) if holding_secs else 0.0

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

    if avg_hold > 0:
        if avg_hold < 300:
            trading_style = 'Scalper'
        elif avg_hold < 14400:
            trading_style = 'Day Trader'
        elif avg_hold < 604800:
            trading_style = 'Swing Trader'
        else:
            trading_style = 'Position Trader'
    else:
        trading_style = None

    session_trades = {'asian': [], 'london': [], 'newyork': []}
    for trade in day_trades:
        hour = trade['_close_dt'].hour
        if 0 <= hour < 8:
            session_trades['asian'].append(trade)
        if 8 <= hour < 16:
            session_trades['london'].append(trade)
        if 13 <= hour < 21:
            session_trades['newyork'].append(trade)

    asian_profit, asian_wr = _calc_session(session_trades['asian'])
    london_profit, london_wr = _calc_session(session_trades['london'])
    ny_profit, ny_wr = _calc_session(session_trades['newyork'])

    equity_series = [float(snapshot['equity']) for snapshot in day_snapshots]
    peak_equity = max(equity_series) if equity_series else None
    max_drawdown = _calc_drawdown(equity_series)

    equity_growth = 0.0
    if len(equity_series) >= 2 and equity_series[0] > 0:
        equity_growth = ((equity_series[-1] - equity_series[0]) / equity_series[0]) * 100

    balance = float(end_state['balance']) if end_state and end_state.get('balance') is not None else 0.0
    equity = float(end_state['equity']) if end_state and end_state.get('equity') is not None else 0.0
    floating_pl = float(end_state['floating_pl']) if end_state and end_state.get('floating_pl') is not None else 0.0
    margin_level = float(end_state['margin_level']) if end_state and end_state.get('margin_level') is not None else None

    if peak_equity is None:
        peak_equity = max(equity, balance)

    return {
        'client_account_id': account_id,
        'date': day.isoformat(),
        'balance': round(balance, 2),
        'equity': round(equity, 2),
        'profit': round(sum(float(trade['profit']) for trade in day_trades), 2),
        'floating_pl': round(floating_pl, 2),
        'margin_level': round(margin_level, 2) if margin_level is not None else None,
        'total_lots': round(total_lots, 2),
        'win_rate': round((len(wins) / total * 100), 1) if total > 0 else 0.0,
        'total_trades': total,
        'profit_factor': round((gross_profit / gross_loss), 2) if gross_loss > 0 else 0.0,
        'rr_ratio': round((avg_win / avg_loss), 2) if avg_loss > 0 else 0.0,
        'max_drawdown': max_drawdown,
        'peak_equity': round(peak_equity, 2) if peak_equity is not None else None,
        'avg_win': round(avg_win, 2),
        'avg_loss': round(avg_loss, 2),
        'best_trade': round(best_trade, 2),
        'worst_trade': round(worst_trade, 2),
        'win_rate_buy': round((sum(1 for trade in buy_trades if float(trade['profit']) > 0) / len(buy_trades) * 100), 1) if buy_trades else 0.0,
        'win_rate_sell': round((sum(1 for trade in sell_trades if float(trade['profit']) > 0) / len(sell_trades) * 100), 1) if sell_trades else 0.0,
        'max_consecutive_wins': max_consec_wins,
        'max_consecutive_losses': max_consec_losses,
        'session_asian_profit': asian_profit,
        'session_asian_win_rate': asian_wr,
        'session_london_profit': london_profit,
        'session_london_win_rate': london_wr,
        'session_newyork_profit': ny_profit,
        'session_newyork_win_rate': ny_wr,
        'trading_style': trading_style,
        'favorite_pair': favorite_pair,
        'avg_holding_time': avg_holding_time,
        'equity_growth_percent': round(equity_growth, 2)
    }


def recompute_daily_stats_for_account(
    supabase: Any,
    account_id: str,
    touched_dates: set[date] | None = None,
    current_state: dict[str, Any] | None = None,
    replace_existing: bool = False
) -> int:
    trades_resp = supabase.table('trades') \
        .select('profit, type, symbol, lot_size, open_time, close_time') \
        .eq('client_account_id', account_id) \
        .execute()
    snapshots_resp = supabase.table('equity_snapshots') \
        .select('timestamp, balance, equity, floating_pl, margin_level') \
        .eq('client_account_id', account_id) \
        .order('timestamp', desc=False) \
        .execute()

    trades = _prepare_trades(trades_resp.data or [])
    snapshots = _prepare_snapshots(snapshots_resp.data or [])

    if current_state and current_state.get('timestamp'):
        current_timestamp = parse_iso_datetime(current_state['timestamp'])
        if current_timestamp:
            current_state = {
                **current_state,
                '_timestamp': current_timestamp
            }
        else:
            current_state = None

    if touched_dates is None:
        touched_dates = close_trade_dates_from_rows(trades_resp.data or [])
        touched_dates.update(
            snapshot['_timestamp'].date()
            for snapshot in snapshots
        )
        if current_state:
            touched_dates.add(current_state['_timestamp'].date())

    if not touched_dates:
        return 0

    rows = [
        build_daily_stats_row(account_id, day, trades, snapshots, current_state)
        for day in sorted(touched_dates)
    ]

    if replace_existing:
        supabase.table('daily_stats').delete().eq('client_account_id', account_id).execute()

    supabase.table('daily_stats').upsert(rows, on_conflict='client_account_id,date').execute()
    return len(rows)
