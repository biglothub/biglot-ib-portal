"""Tests for stats.py — pure logic, no external dependencies."""
from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest

from stats import (
    parse_iso_datetime,
    close_trade_dates_from_rows,
    _prepare_trades,
    _prepare_snapshots,
    _day_bounds,
    _calc_drawdown,
    _calc_session,
    build_daily_stats_row,
    recompute_daily_stats_for_account,
)

UTC = timezone.utc


# ===================================================================
# helpers
# ===================================================================

def _prep(trades):
    """Shorthand: run _prepare_trades so build_daily_stats_row can use them."""
    return _prepare_trades(trades)


def _prep_snap(snapshots):
    """Shorthand: run _prepare_snapshots."""
    return _prepare_snapshots(snapshots)


# ===================================================================
# parse_iso_datetime
# ===================================================================

class TestParseIsoDatetime:
    def test_z_suffix(self):
        result = parse_iso_datetime('2025-01-15T10:00:00Z')
        assert result == datetime(2025, 1, 15, 10, 0, tzinfo=UTC)

    def test_with_offset(self):
        result = parse_iso_datetime('2025-01-15T13:00:00+03:00')
        assert result == datetime(2025, 1, 15, 10, 0, tzinfo=UTC)

    def test_none(self):
        assert parse_iso_datetime(None) is None

    def test_empty_string(self):
        assert parse_iso_datetime('') is None

    def test_invalid(self):
        assert parse_iso_datetime('not-a-date') is None


# ===================================================================
# close_trade_dates_from_rows
# ===================================================================

class TestCloseTradeDates:
    def test_multiple_dates(self):
        rows = [
            {'close_time': '2025-01-15T10:00:00Z'},
            {'close_time': '2025-01-15T14:00:00Z'},
            {'close_time': '2025-01-16T08:00:00Z'},
        ]
        result = close_trade_dates_from_rows(rows)
        assert result == {date(2025, 1, 15), date(2025, 1, 16)}

    def test_empty(self):
        assert close_trade_dates_from_rows([]) == set()

    def test_missing_close_time(self):
        rows = [{'close_time': None}, {'other': 'data'}]
        assert close_trade_dates_from_rows(rows) == set()


# ===================================================================
# _prepare_trades
# ===================================================================

class TestPrepareTrades:
    def test_adds_datetime_keys(self, make_trade):
        trades = [make_trade()]
        result = _prepare_trades(trades)
        assert len(result) == 1
        assert isinstance(result[0]['_close_dt'], datetime)
        assert isinstance(result[0]['_open_dt'], datetime)

    def test_skips_no_close_time(self, make_trade):
        trades = [make_trade(close_time=None)]
        assert _prepare_trades(trades) == []

    def test_preserves_original_keys(self, make_trade):
        trades = [make_trade(profit=42.0, symbol='GBPUSD')]
        result = _prepare_trades(trades)
        assert result[0]['profit'] == 42.0
        assert result[0]['symbol'] == 'GBPUSD'


# ===================================================================
# _prepare_snapshots
# ===================================================================

class TestPrepareSnapshots:
    def test_sorted_by_time(self, make_snapshot):
        snapshots = [
            make_snapshot(timestamp='2025-01-15T14:00:00Z'),
            make_snapshot(timestamp='2025-01-15T10:00:00Z'),
            make_snapshot(timestamp='2025-01-15T12:00:00Z'),
        ]
        result = _prepare_snapshots(snapshots)
        times = [s['_timestamp'] for s in result]
        assert times == sorted(times)

    def test_skips_invalid(self, make_snapshot):
        snapshots = [
            make_snapshot(timestamp=None),
            make_snapshot(timestamp='2025-01-15T10:00:00Z'),
        ]
        result = _prepare_snapshots(snapshots)
        assert len(result) == 1


# ===================================================================
# _day_bounds
# ===================================================================

class TestDayBounds:
    def test_returns_correct_range(self):
        start, end = _day_bounds(date(2025, 1, 15))
        assert start == datetime(2025, 1, 15, 0, 0, tzinfo=UTC)
        assert end == datetime(2025, 1, 16, 0, 0, tzinfo=UTC)


# ===================================================================
# _calc_drawdown
# ===================================================================

class TestCalcDrawdown:
    def test_empty(self):
        assert _calc_drawdown([]) == 0.0

    def test_monotonic_rise(self):
        assert _calc_drawdown([100, 200, 300]) == 0.0

    def test_simple_drop(self):
        # peak=100, drop to 80 → 20%
        assert _calc_drawdown([100, 80]) == 20.0

    def test_recovery_then_drop(self):
        # peak=120, drop to 90 → (120-90)/120*100 = 25%
        assert _calc_drawdown([100, 120, 90]) == 25.0

    def test_zero_peak(self):
        assert _calc_drawdown([0, 0, 0]) == 0.0

    def test_single_value(self):
        assert _calc_drawdown([500]) == 0.0


# ===================================================================
# _calc_session
# ===================================================================

class TestCalcSession:
    def test_empty(self):
        assert _calc_session([]) == (0.0, 0.0)

    def test_all_wins(self):
        trades = [{'profit': 10}, {'profit': 20}, {'profit': 30}]
        profit, wr = _calc_session(trades)
        assert profit == 60.0
        assert wr == 100.0

    def test_mixed(self):
        trades = [{'profit': 10}, {'profit': 20}, {'profit': -15}]
        profit, wr = _calc_session(trades)
        assert profit == 15.0
        assert wr == pytest.approx(66.7, abs=0.1)

    def test_all_losses(self):
        trades = [{'profit': -10}, {'profit': -20}]
        profit, wr = _calc_session(trades)
        assert profit == -30.0
        assert wr == 0.0


# ===================================================================
# build_daily_stats_row
# ===================================================================

DAY = date(2025, 1, 15)
ACCOUNT_ID = 'test-account-id'


class TestBuildDailyStatsBasic:
    def test_single_winning_trade(self, make_trade, make_snapshot):
        trades = _prep([make_trade(profit=50.0, type_='BUY')])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['total_trades'] == 1
        assert row['win_rate'] == 100.0
        assert row['profit'] == 50.0
        assert row['max_consecutive_wins'] == 1
        assert row['max_consecutive_losses'] == 0

    def test_single_losing_trade(self, make_trade, make_snapshot):
        trades = _prep([make_trade(profit=-30.0)])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['total_trades'] == 1
        assert row['win_rate'] == 0.0
        assert row['profit'] == -30.0


class TestBuildDailyStatsDivisionByZero:
    def test_no_trades(self, make_snapshot):
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)

        assert row['total_trades'] == 0
        assert row['win_rate'] == 0.0
        assert row['profit_factor'] == 0.0
        assert row['rr_ratio'] == 0.0
        assert row['avg_win'] == 0.0
        assert row['avg_loss'] == 0.0
        assert row['best_trade'] == 0.0
        assert row['worst_trade'] == 0.0
        assert row['favorite_pair'] is None

    def test_only_wins(self, make_trade, make_snapshot):
        trades = _prep([
            make_trade(profit=10.0),
            make_trade(profit=20.0, close_time='2025-01-15T11:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['profit_factor'] == 0.0  # no losses → guarded
        assert row['avg_loss'] == 0.0

    def test_only_losses(self, make_trade, make_snapshot):
        trades = _prep([
            make_trade(profit=-10.0),
            make_trade(profit=-20.0, close_time='2025-01-15T11:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['profit_factor'] == 0.0  # no wins → guarded
        assert row['avg_win'] == 0.0
        assert row['rr_ratio'] == 0.0


class TestBuildDailyStatsConsecutive:
    def test_wwlwww(self, make_trade, make_snapshot):
        profits = [10, 20, -5, 15, 25, 30]
        trades = _prep([
            make_trade(profit=p, close_time=f'2025-01-15T{10+i}:00:00Z')
            for i, p in enumerate(profits)
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['max_consecutive_wins'] == 3
        assert row['max_consecutive_losses'] == 1

    def test_breakeven_resets(self, make_trade, make_snapshot):
        # win, breakeven, win → max_consecutive_wins should be 1
        trades = _prep([
            make_trade(profit=10, close_time='2025-01-15T10:00:00Z'),
            make_trade(profit=0, close_time='2025-01-15T11:00:00Z'),
            make_trade(profit=10, close_time='2025-01-15T12:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['max_consecutive_wins'] == 1
        assert row['max_consecutive_losses'] == 0


class TestBuildDailyStatsSessions:
    def test_asian_at_3am(self, make_trade, make_snapshot):
        trades = _prep([make_trade(profit=10, close_time='2025-01-15T03:00:00Z')])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T04:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['session_asian_profit'] == 10.0
        assert row['session_london_profit'] == 0.0
        assert row['session_newyork_profit'] == 0.0

    def test_london_ny_overlap_at_14(self, make_trade, make_snapshot):
        trades = _prep([make_trade(profit=20, close_time='2025-01-15T14:00:00Z')])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T15:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['session_asian_profit'] == 0.0
        assert row['session_london_profit'] == 20.0
        assert row['session_newyork_profit'] == 20.0  # overlap 13-16

    def test_no_session_at_22(self, make_trade, make_snapshot):
        trades = _prep([make_trade(profit=15, close_time='2025-01-15T22:00:00Z')])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T23:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)

        assert row['session_asian_profit'] == 0.0
        assert row['session_london_profit'] == 0.0
        assert row['session_newyork_profit'] == 0.0


class TestBuildDailyStatsTradingStyle:
    def _make_trade_with_hold(self, make_trade, hold_seconds):
        return make_trade(
            open_time='2025-01-15T10:00:00Z',
            close_time=datetime(2025, 1, 15, 10, 0, tzinfo=UTC)
            .__add__(__import__('datetime').timedelta(seconds=hold_seconds))
            .isoformat(),
        )

    def test_scalper(self, make_trade, make_snapshot):
        # hold < 300s (5 min) → Scalper
        trade = make_trade(
            open_time='2025-01-15T10:00:00Z',
            close_time='2025-01-15T10:02:00Z',  # 2 min
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['trading_style'] == 'Scalper'

    def test_day_trader(self, make_trade, make_snapshot):
        # hold 1 hour → Day Trader (300s < 3600s < 14400s)
        trade = make_trade(
            open_time='2025-01-15T10:00:00Z',
            close_time='2025-01-15T11:00:00Z',
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['trading_style'] == 'Day Trader'

    def test_swing_trader(self, make_trade, make_snapshot):
        # hold 3 days → Swing Trader (14400s < 259200s < 604800s)
        trade = make_trade(
            open_time='2025-01-12T10:00:00Z',
            close_time='2025-01-15T10:00:00Z',
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['trading_style'] == 'Swing Trader'

    def test_position_trader(self, make_trade, make_snapshot):
        # hold 10 days → Position Trader (> 604800s)
        trade = make_trade(
            open_time='2025-01-05T10:00:00Z',
            close_time='2025-01-15T10:00:00Z',
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['trading_style'] == 'Position Trader'

    def test_no_trades_none(self, make_snapshot):
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['trading_style'] is None


class TestBuildDailyStatsHoldingTime:
    def test_seconds(self, make_trade, make_snapshot):
        trade = make_trade(
            open_time='2025-01-15T10:00:00Z',
            close_time='2025-01-15T10:00:45Z',  # 45s
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['avg_holding_time'] == '45s'

    def test_minutes(self, make_trade, make_snapshot):
        trade = make_trade(
            open_time='2025-01-15T10:00:00Z',
            close_time='2025-01-15T10:10:00Z',  # 600s → 10m
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['avg_holding_time'] == '10m'

    def test_hours_minutes(self, make_trade, make_snapshot):
        trade = make_trade(
            open_time='2025-01-15T10:00:00Z',
            close_time='2025-01-15T11:30:00Z',  # 5400s → 1h 30m
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['avg_holding_time'] == '1h 30m'

    def test_days_hours(self, make_trade, make_snapshot):
        trade = make_trade(
            open_time='2025-01-14T09:00:00Z',
            close_time='2025-01-15T10:00:00Z',  # 90000s → 1d 1h
        )
        trades = _prep([trade])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['avg_holding_time'] == '1d 1h'

    def test_no_trades_none(self, make_snapshot):
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['avg_holding_time'] is None


class TestBuildDailyStatsFavoritePair:
    def test_most_traded(self, make_trade, make_snapshot):
        trades = _prep([
            make_trade(symbol='EURUSD', close_time='2025-01-15T10:00:00Z'),
            make_trade(symbol='EURUSD', close_time='2025-01-15T11:00:00Z'),
            make_trade(symbol='EURUSD', close_time='2025-01-15T12:00:00Z'),
            make_trade(symbol='GBPUSD', close_time='2025-01-15T13:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T14:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['favorite_pair'] == 'EURUSD'


class TestBuildDailyStatsBuySellWinRate:
    def test_separate(self, make_trade, make_snapshot):
        trades = _prep([
            make_trade(type_='BUY', profit=10, close_time='2025-01-15T10:00:00Z'),
            make_trade(type_='BUY', profit=-5, close_time='2025-01-15T11:00:00Z'),
            make_trade(type_='SELL', profit=20, close_time='2025-01-15T12:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T13:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['win_rate_buy'] == 50.0
        assert row['win_rate_sell'] == 100.0

    def test_no_buy_trades(self, make_trade, make_snapshot):
        trades = _prep([
            make_trade(type_='SELL', profit=10, close_time='2025-01-15T10:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['win_rate_buy'] == 0.0
        assert row['win_rate_sell'] == 100.0


class TestBuildDailyStatsEquity:
    def test_growth_positive(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(timestamp='2025-01-15T08:00:00Z', equity=10000),
            make_snapshot(timestamp='2025-01-15T16:00:00Z', equity=11000),
        ])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['equity_growth_percent'] == 10.0

    def test_growth_negative(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(timestamp='2025-01-15T08:00:00Z', equity=10000),
            make_snapshot(timestamp='2025-01-15T16:00:00Z', equity=9000),
        ])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['equity_growth_percent'] == -10.0

    def test_single_snapshot(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(timestamp='2025-01-15T12:00:00Z', equity=10000),
        ])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['equity_growth_percent'] == 0.0

    def test_zero_start_equity(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(timestamp='2025-01-15T08:00:00Z', equity=0),
            make_snapshot(timestamp='2025-01-15T16:00:00Z', equity=1000),
        ])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['equity_growth_percent'] == 0.0  # guarded


class TestBuildDailyStatsPeakEquity:
    def test_from_snapshots(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(timestamp='2025-01-15T08:00:00Z', equity=10000),
            make_snapshot(timestamp='2025-01-15T12:00:00Z', equity=12000),
            make_snapshot(timestamp='2025-01-15T16:00:00Z', equity=11000),
        ])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['peak_equity'] == 12000.0

    def test_fallback_no_snapshots(self):
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], [])
        # no snapshots, no end_state → balance=0, equity=0 → peak_equity=0
        assert row['peak_equity'] == 0.0


class TestBuildDailyStatsEndState:
    def test_from_snapshot(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(
                timestamp='2025-01-15T23:00:00Z',
                balance=12000, equity=12500
            ),
        ])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['balance'] == 12000.0
        assert row['equity'] == 12500.0

    def test_from_current_state(self, make_snapshot):
        snaps = _prep_snap([
            make_snapshot(
                timestamp='2025-01-15T20:00:00Z',
                balance=11000, equity=11500
            ),
        ])
        current_state = {
            '_timestamp': datetime(2025, 1, 15, 22, 0, tzinfo=UTC),
            'balance': 12000, 'equity': 12800,
            'floating_pl': 800, 'margin_level': 600,
        }
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps, current_state)
        assert row['balance'] == 12000.0
        assert row['equity'] == 12800.0

    def test_no_data(self):
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], [])
        assert row['balance'] == 0.0
        assert row['equity'] == 0.0
        assert row['floating_pl'] == 0.0
        assert row['margin_level'] is None


class TestBuildDailyStatsOutput:
    EXPECTED_KEYS = {
        'client_account_id', 'date', 'balance', 'equity', 'profit',
        'floating_pl', 'margin_level', 'total_lots', 'win_rate',
        'total_trades', 'profit_factor', 'rr_ratio', 'max_drawdown',
        'peak_equity', 'avg_win', 'avg_loss', 'best_trade', 'worst_trade',
        'win_rate_buy', 'win_rate_sell', 'max_consecutive_wins',
        'max_consecutive_losses', 'session_asian_profit',
        'session_asian_win_rate', 'session_london_profit',
        'session_london_win_rate', 'session_newyork_profit',
        'session_newyork_win_rate', 'trading_style', 'favorite_pair',
        'avg_holding_time', 'equity_growth_percent',
    }

    def test_all_keys_present(self, make_snapshot):
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert set(row.keys()) == self.EXPECTED_KEYS

    def test_date_format(self, make_snapshot):
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['date'] == '2025-01-15'

    def test_account_id(self, make_snapshot):
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, [], snaps)
        assert row['client_account_id'] == ACCOUNT_ID


class TestBuildDailyStatsProfitFactor:
    def test_normal(self, make_trade, make_snapshot):
        trades = _prep([
            make_trade(profit=100, close_time='2025-01-15T10:00:00Z'),
            make_trade(profit=-50, close_time='2025-01-15T11:00:00Z'),
        ])
        snaps = _prep_snap([make_snapshot(timestamp='2025-01-15T12:00:00Z')])
        row = build_daily_stats_row(ACCOUNT_ID, DAY, trades, snaps)
        assert row['profit_factor'] == 2.0  # 100 / 50
        assert row['rr_ratio'] == 2.0  # avg_win(100) / avg_loss(50)


# ===================================================================
# recompute_daily_stats_for_account
# ===================================================================

class TestRecomputeDailyStats:
    def _make_supabase(self, trades_data=None, snapshots_data=None):
        from tests.conftest import FakeTableQuery

        def table(name):
            if name == 'trades':
                return FakeTableQuery(data=trades_data or [])
            elif name == 'equity_snapshots':
                return FakeTableQuery(data=snapshots_data or [])
            elif name == 'daily_stats':
                return FakeTableQuery(data=[])
            return FakeTableQuery()

        mock = MagicMock()
        mock.table.side_effect = table
        return mock

    def test_no_data(self):
        sb = self._make_supabase()
        result = recompute_daily_stats_for_account(sb, ACCOUNT_ID)
        assert result == 0

    def test_basic_one_day(self):
        trades = [
            {'profit': 10, 'type': 'BUY', 'symbol': 'EURUSD', 'lot_size': 0.1,
             'open_time': '2025-01-15T10:00:00Z', 'close_time': '2025-01-15T10:30:00Z'},
        ]
        snaps = [
            {'timestamp': '2025-01-15T12:00:00Z', 'balance': 10000,
             'equity': 10050, 'floating_pl': 50, 'margin_level': 500},
        ]
        sb = self._make_supabase(trades_data=trades, snapshots_data=snaps)
        result = recompute_daily_stats_for_account(sb, ACCOUNT_ID)
        assert result >= 1

    def test_multiple_days(self):
        trades = [
            {'profit': 10, 'type': 'BUY', 'symbol': 'EURUSD', 'lot_size': 0.1,
             'open_time': '2025-01-15T10:00:00Z', 'close_time': '2025-01-15T10:30:00Z'},
            {'profit': -5, 'type': 'SELL', 'symbol': 'GBPUSD', 'lot_size': 0.2,
             'open_time': '2025-01-16T08:00:00Z', 'close_time': '2025-01-16T09:00:00Z'},
            {'profit': 20, 'type': 'BUY', 'symbol': 'EURUSD', 'lot_size': 0.1,
             'open_time': '2025-01-17T14:00:00Z', 'close_time': '2025-01-17T15:00:00Z'},
        ]
        sb = self._make_supabase(trades_data=trades)
        result = recompute_daily_stats_for_account(sb, ACCOUNT_ID)
        assert result == 3

    def test_with_touched_dates(self):
        trades = [
            {'profit': 10, 'type': 'BUY', 'symbol': 'EURUSD', 'lot_size': 0.1,
             'open_time': '2025-01-15T10:00:00Z', 'close_time': '2025-01-15T10:30:00Z'},
        ]
        sb = self._make_supabase(trades_data=trades)
        result = recompute_daily_stats_for_account(
            sb, ACCOUNT_ID,
            touched_dates={date(2025, 1, 15)}
        )
        assert result == 1

    def test_with_replace_existing(self):
        trades = [
            {'profit': 10, 'type': 'BUY', 'symbol': 'EURUSD', 'lot_size': 0.1,
             'open_time': '2025-01-15T10:00:00Z', 'close_time': '2025-01-15T10:30:00Z'},
        ]
        sb = self._make_supabase(trades_data=trades)
        recompute_daily_stats_for_account(
            sb, ACCOUNT_ID,
            touched_dates={date(2025, 1, 15)},
            replace_existing=True,
        )
        # Verify delete was called on daily_stats
        calls = [str(c) for c in sb.table.call_args_list]
        assert any('daily_stats' in c for c in calls)

    def test_with_current_state(self):
        sb = self._make_supabase()
        result = recompute_daily_stats_for_account(
            sb, ACCOUNT_ID,
            touched_dates={date(2025, 1, 15)},
            current_state={
                'timestamp': '2025-01-15T22:00:00Z',
                'balance': 12000, 'equity': 12800,
                'floating_pl': 800, 'margin_level': 600,
            }
        )
        assert result == 1
