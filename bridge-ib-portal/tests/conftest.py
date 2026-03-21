"""Shared fixtures for bridge-ib-portal tests."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Trade / Snapshot factories
# ---------------------------------------------------------------------------

@pytest.fixture
def make_trade():
    """Factory for trade dicts matching the shape expected by stats.py."""
    def _make(
        *,
        profit=10.0,
        type_='BUY',
        symbol='EURUSD',
        lot_size=0.1,
        open_time='2025-01-15T10:00:00Z',
        close_time='2025-01-15T10:30:00Z',
        pips=5.0,
    ):
        return {
            'profit': profit,
            'type': type_,
            'symbol': symbol,
            'lot_size': lot_size,
            'open_time': open_time,
            'close_time': close_time,
            'pips': pips,
        }
    return _make


@pytest.fixture
def make_snapshot():
    """Factory for equity snapshot dicts."""
    def _make(
        *,
        timestamp='2025-01-15T12:00:00Z',
        balance=10000.0,
        equity=10050.0,
        floating_pl=50.0,
        margin_level=500.0,
    ):
        return {
            'timestamp': timestamp,
            'balance': balance,
            'equity': equity,
            'floating_pl': floating_pl,
            'margin_level': margin_level,
        }
    return _make


# ---------------------------------------------------------------------------
# Supabase fluent-API mock
# ---------------------------------------------------------------------------

class FakeTableQuery:
    """Mimics Supabase's chaining: table().select().eq().execute()"""

    def __init__(self, data=None):
        self._data = data if data is not None else []
        self._calls = []

    def select(self, *a, **kw):
        self._calls.append(('select', a, kw))
        return self

    def eq(self, *a, **kw):
        self._calls.append(('eq', a, kw))
        return self

    def order(self, *a, **kw):
        self._calls.append(('order', a, kw))
        return self

    def delete(self, *a, **kw):
        self._calls.append(('delete', a, kw))
        return self

    def update(self, *a, **kw):
        self._calls.append(('update', a, kw))
        return self

    def insert(self, *a, **kw):
        self._calls.append(('insert', a, kw))
        return self

    def upsert(self, *a, **kw):
        self._calls.append(('upsert', a, kw))
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


@pytest.fixture
def mock_supabase():
    """Return a mock supabase client with configurable table data."""
    table_data: dict[str, list] = {}
    queries: dict[str, list[FakeTableQuery]] = {}

    def _table(name):
        q = FakeTableQuery(data=table_data.get(name, []))
        queries.setdefault(name, []).append(q)
        return q

    client = MagicMock()
    client.table.side_effect = _table
    client._table_data = table_data
    client._queries = queries
    return client


# ---------------------------------------------------------------------------
# MT5 mock module (for test_core.py / test_main.py)
# ---------------------------------------------------------------------------

def _create_mt5_mock():
    """Create a fake MetaTrader5 module."""
    mock = MagicMock()
    mock.initialize.return_value = True
    mock.login.return_value = True
    mock.last_error.return_value = (0, 'OK')
    mock.terminal_info.return_value = SimpleNamespace(name='test')
    mock.account_info.return_value = SimpleNamespace(
        balance=10000.0, equity=10050.0, margin_level=500.0
    )
    mock.TIMEFRAME_M5 = 'TIMEFRAME_M5'
    mock.positions_get.return_value = []
    mock.history_deals_get.return_value = []
    mock.copy_rates_range.return_value = []
    mock.symbol_info.return_value = None  # default: no symbol info
    return mock


@pytest.fixture
def mt5_mock():
    """Provide a fresh MT5 mock (does NOT patch sys.modules)."""
    return _create_mt5_mock()


# ---------------------------------------------------------------------------
# MT5 deal / position factories
# ---------------------------------------------------------------------------

@pytest.fixture
def make_deal():
    """Factory for MT5 deal objects (SimpleNamespace)."""
    def _make(*, entry=0, position_id=123, symbol='EURUSD', type_=0,
              volume=0.1, price=1.1000, time_=1705312800, profit=0.0,
              commission=0.0, swap=0.0):
        return SimpleNamespace(
            entry=entry, position_id=position_id, symbol=symbol,
            type=type_, volume=volume, price=price, time=time_, profit=profit,
            commission=commission, swap=swap,
        )
    return _make


@pytest.fixture
def make_position():
    """Factory for MT5 position objects (SimpleNamespace)."""
    def _make(*, ticket=456, symbol='EURUSD', type_=0, volume=0.1,
              price_open=1.1000, price_current=1.1050, time_=1705312800,
              profit=50.0, sl=0.0, tp=0.0):
        return SimpleNamespace(
            ticket=ticket, symbol=symbol, type=type_, volume=volume,
            price_open=price_open, price_current=price_current,
            time=time_, profit=profit, sl=sl, tp=tp,
        )
    return _make
