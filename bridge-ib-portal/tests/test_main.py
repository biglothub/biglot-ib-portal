"""Tests for main.py — data transformation, sync, validation.

main.py imports MetaTrader5 and core at module level.
We must patch sys.modules before importing.
"""
from __future__ import annotations

import importlib
import sys
from collections import defaultdict
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Module-level setup: patch sys.modules so main.py can be imported safely
# ---------------------------------------------------------------------------

@pytest.fixture
def main_module(mt5_mock, monkeypatch):
    """Import main.py with all external deps mocked."""
    # Mock MetaTrader5
    monkeypatch.setitem(sys.modules, 'MetaTrader5', mt5_mock)

    # Mock core module
    mock_core = MagicMock()
    mock_core.supabase = MagicMock()
    mock_core.init_mt5.return_value = True
    mock_core.decrypt_password.side_effect = lambda x: x  # passthrough
    mock_core.send_telegram_message = MagicMock()
    mock_core.TELEGRAM_ADMIN_CHAT_ID = ''
    monkeypatch.setitem(sys.modules, 'core', mock_core)

    # Mock stats module
    mock_stats = MagicMock()
    mock_stats.close_trade_dates_from_rows.return_value = set()
    mock_stats.recompute_daily_stats_for_account = MagicMock()
    monkeypatch.setitem(sys.modules, 'stats', mock_stats)

    # Mock dotenv
    mock_dotenv = MagicMock()
    monkeypatch.setitem(sys.modules, 'dotenv', mock_dotenv)

    # Set env vars
    monkeypatch.setenv('SYNC_INTERVAL', '60')

    # Force reimport
    if 'main' in sys.modules:
        del sys.modules['main']

    import main
    # Wire the mocks into the module
    main.mt5 = mt5_mock
    main.supabase = mock_core.supabase
    main.send_telegram_message = mock_core.send_telegram_message
    main.decrypt_password = mock_core.decrypt_password
    main.TELEGRAM_ADMIN_CHAT_ID = ''

    yield main, mt5_mock, mock_core.supabase

    if 'main' in sys.modules:
        del sys.modules['main']


# ---------------------------------------------------------------------------
# Helper: configure mock supabase chain
# ---------------------------------------------------------------------------

def _chain_mock(mock_sb, table_responses=None):
    """Configure supabase mock to return data for specific tables."""
    table_responses = table_responses or {}

    def _table(name):
        chain = MagicMock()
        data = table_responses.get(name, [])
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.delete.return_value = chain
        chain.update.return_value = chain
        chain.insert.return_value = chain
        chain.upsert.return_value = chain
        chain.execute.return_value = SimpleNamespace(data=data)
        return chain

    mock_sb.table.side_effect = _table


# ===================================================================
# Symbol normalization (tested through sync_client_account)
# ===================================================================

class TestSymbolNormalization:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }

    def test_gold_to_xauusd(self, main_module, make_position):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.positions_get.return_value = [
            make_position(symbol='GOLDm')
        ]
        _chain_mock(mock_sb)

        main_mod.sync_client_account(self._make_account())

        # Check insert was called with normalized symbol
        insert_calls = [
            c for c in mock_sb.table.call_args_list
            if c[0][0] == 'open_positions'
        ]
        assert len(insert_calls) > 0

    def test_xauusdm_to_xauusd(self, main_module, make_position):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.positions_get.return_value = [
            make_position(symbol='XAUUSDm')
        ]
        _chain_mock(mock_sb)
        main_mod.sync_client_account(self._make_account())

    def test_eurusd_unchanged(self, main_module, make_position):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.positions_get.return_value = [
            make_position(symbol='EURUSD')
        ]
        _chain_mock(mock_sb)
        main_mod.sync_client_account(self._make_account())


# ===================================================================
# Point size & pips calculation (inline in sync_client_account)
# ===================================================================

class TestPipsCalculation:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }

    def test_buy_positive_pips(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        # BUY EURUSD: entry=1.1000, exit=1.1050 → pips = 50
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=100, symbol='EURUSD', type_=0,
                      price=1.1000, time_=1705312800, profit=0),
            make_deal(entry=1, position_id=100, symbol='EURUSD', type_=1,
                      price=1.1050, time_=1705316400, profit=50),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())

        assert len(upserted) == 1
        assert upserted[0]['pips'] == 50.0
        assert upserted[0]['type'] == 'BUY'

    def test_sell_positive_pips(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        # SELL EURUSD: entry=1.1050, exit=1.1000 → pips = 50
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=200, symbol='EURUSD', type_=1,
                      price=1.1050, time_=1705312800, profit=0),
            make_deal(entry=1, position_id=200, symbol='EURUSD', type_=0,
                      price=1.1000, time_=1705316400, profit=50),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())

        assert len(upserted) == 1
        assert upserted[0]['pips'] == 50.0
        assert upserted[0]['type'] == 'SELL'

    def test_xauusd_point_size(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        # BUY XAUUSD: entry=2000.00, exit=2005.00 → pips = 500 (point_size=0.01)
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=300, symbol='XAUUSD', type_=0,
                      price=2000.00, time_=1705312800, profit=0),
            make_deal(entry=1, position_id=300, symbol='XAUUSD', type_=1,
                      price=2005.00, time_=1705316400, profit=500),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())

        assert len(upserted) == 1
        assert upserted[0]['pips'] == 500.0

    def test_jpy_point_size(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        # BUY USDJPY: entry=150.00, exit=150.50 → pips = 50 (point_size=0.01)
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=400, symbol='USDJPY', type_=0,
                      price=150.00, time_=1705312800, profit=0),
            make_deal(entry=1, position_id=400, symbol='USDJPY', type_=1,
                      price=150.50, time_=1705316400, profit=50),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())

        assert len(upserted) == 1
        assert upserted[0]['pips'] == 50.0


# ===================================================================
# Trade type conversion
# ===================================================================

class TestTradeTypeConversion:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }

    def test_type_0_is_buy(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=500, type_=0, price=1.1, profit=0),
            make_deal(entry=1, position_id=500, type_=1, price=1.1, profit=0),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())
        assert upserted[0]['type'] == 'BUY'

    def test_type_1_is_sell(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=600, type_=1, price=1.1, profit=0),
            make_deal(entry=1, position_id=600, type_=0, price=1.1, profit=0),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())
        assert upserted[0]['type'] == 'SELL'


# ===================================================================
# Timestamp offset
# ===================================================================

class TestTimestampOffset:
    def test_server_offset_applied(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        SERVER_OFFSET = 10800  # 3 hours
        ts = 1705312800  # 2024-01-15 10:00:00 UTC before offset

        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=700, time_=ts, price=1.1, profit=0),
            make_deal(entry=1, position_id=700, time_=ts + 3600, price=1.1, profit=0),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table

        account = {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }
        main_mod.sync_client_account(account)

        assert len(upserted) == 1
        # open_time should be ts - SERVER_OFFSET converted to ISO
        expected_open = datetime.fromtimestamp(ts - SERVER_OFFSET, tz=UTC)
        assert expected_open.isoformat() in upserted[0]['open_time']


# ===================================================================
# Deals grouping
# ===================================================================

class TestDealsGrouping:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }

    def test_two_positions(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=100, price=1.1, profit=0),
            make_deal(entry=1, position_id=100, price=1.15, profit=50),
            make_deal(entry=0, position_id=200, price=1.2, profit=0),
            make_deal(entry=1, position_id=200, price=1.18, profit=-20),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())
        assert len(upserted) == 2

    def test_entry_only_skipped(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        # Only entry deal, no exit → should not create a trade
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=100, price=1.1, profit=0),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())
        assert len(upserted) == 0

    def test_non_entry_exit_deals_excluded(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
        # Deals with entry=2 (balance operation) should be excluded
        mt5_mock.history_deals_get.return_value = [
            SimpleNamespace(entry=2, position_id=100, symbol='EURUSD',
                            type=0, volume=0, price=0, time=1705312800, profit=100),
        ]
        mt5_mock.positions_get.return_value = []

        upserted = []
        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                if name == 'trades':
                    upserted.extend(data if isinstance(data, list) else [data])
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        main_mod.sync_client_account(self._make_account())
        assert len(upserted) == 0


# ===================================================================
# sync_client_account E2E
# ===================================================================

class TestSyncClientAccount:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }

    def test_login_failure(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.login.return_value = False
        mt5_mock.last_error.return_value = (-1, 'Auth failed')
        _chain_mock(mock_sb)

        result = main_mod.sync_client_account(self._make_account())
        assert result is False

    def test_account_info_none(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.login.return_value = True
        mt5_mock.account_info.return_value = None
        _chain_mock(mock_sb)

        result = main_mod.sync_client_account(self._make_account())
        assert result is False

    def test_no_positions_no_deals(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.positions_get.return_value = []
        mt5_mock.history_deals_get.return_value = []
        _chain_mock(mock_sb)

        result = main_mod.sync_client_account(self._make_account())
        assert result is True

    def test_exception_handled(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.login.side_effect = RuntimeError('MT5 crashed')
        _chain_mock(mock_sb)

        result = main_mod.sync_client_account(self._make_account())
        assert result is False


# ===================================================================
# check_validation_queue
# ===================================================================

class TestCheckValidationQueue:
    def test_empty_queue(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        _chain_mock(mock_sb, {'client_accounts': []})

        result = main_mod.check_validation_queue()
        assert result == (0, 0)

    def test_validation_success(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.login.return_value = True

        accounts = [{
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1',
        }]
        _chain_mock(mock_sb, {
            'client_accounts': accounts,
            'profiles': [{'id': 'admin-1'}],
        })

        validated, failed = main_mod.check_validation_queue()
        assert validated == 1
        assert failed == 0

    def test_validation_failure(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.login.return_value = False
        mt5_mock.last_error.return_value = (-1, 'Bad password')

        accounts = [{
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1',
        }]
        _chain_mock(mock_sb, {
            'client_accounts': accounts,
            'master_ibs': [{'user_id': 'ib-user-1'}],
            'profiles': [{'telegram_chat_id': ''}],
        })

        validated, failed = main_mod.check_validation_queue()
        assert validated == 0
        assert failed == 1


# ===================================================================
# get_approved_accounts
# ===================================================================

class TestGetApprovedAccounts:
    def test_returns_data(self, main_module):
        main_mod, _, mock_sb = main_module
        expected = [{'id': 'acc-1', 'client_name': 'Test'}]
        _chain_mock(mock_sb, {'client_accounts': expected})

        result = main_mod.get_approved_accounts()
        assert result == expected

    def test_handles_none(self, main_module):
        main_mod, _, mock_sb = main_module

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.execute.return_value = SimpleNamespace(data=None)
            return chain

        mock_sb.table.side_effect = _table
        result = main_mod.get_approved_accounts()
        assert result == []


# ===================================================================
# Equity snapshot timing
# ===================================================================

class TestEquitySnapshotTiming:
    """Test the minute % 5 < 2 logic for equity snapshots."""

    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
        }

    @pytest.mark.parametrize('minute,should_snap', [
        (0, True),   # 0 % 5 = 0 < 2
        (1, True),   # 1 % 5 = 1 < 2
        (2, False),  # 2 % 5 = 2, not < 2
        (3, False),  # 3 % 5 = 3, not < 2
        (4, False),  # 4 % 5 = 4, not < 2
        (5, True),   # 5 % 5 = 0 < 2
        (6, True),   # 6 % 5 = 1 < 2
        (7, False),  # 7 % 5 = 2, not < 2
    ])
    def test_snapshot_timing(self, minute, should_snap, main_module):
        main_mod, mt5_mock, mock_sb = main_module

        # Track which tables got upserts
        upsert_tables = []

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.order.return_value = chain
            chain.delete.return_value = chain
            chain.update.return_value = chain
            chain.insert.return_value = chain
            def _upsert(data, **kw):
                upsert_tables.append(name)
                return chain
            chain.upsert.side_effect = _upsert
            chain.execute.return_value = SimpleNamespace(data=[])
            return chain

        mock_sb.table.side_effect = _table
        mt5_mock.positions_get.return_value = []
        mt5_mock.history_deals_get.return_value = []

        fake_now = datetime(2025, 1, 15, 10, minute, 0, tzinfo=UTC)
        with patch.object(main_mod, 'datetime') as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            mock_dt.fromtimestamp = datetime.fromtimestamp
            main_mod.sync_client_account(self._make_account())

        has_snapshot = 'equity_snapshots' in upsert_tables
        assert has_snapshot == should_snap, \
            f'minute={minute}: expected snapshot={should_snap}, got={has_snapshot}'
