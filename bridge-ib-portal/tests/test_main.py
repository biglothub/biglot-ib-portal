"""Tests for main.py — data transformation, sync, validation, new v2 features.

main.py imports MetaTrader5, core, config, health at module level.
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

    # Mock config module
    mock_config = MagicMock()
    mock_config.SYNC_INTERVAL = 60
    mock_config.SERVER_OFFSET = 10800
    mock_config.TRADE_START = datetime(2024, 1, 1, tzinfo=UTC)
    mock_config.EQUITY_INTERVAL_MINUTES = 5
    mock_config.CHART_CONTEXT_TIMEFRAME = 'M5'
    mock_config.CHART_CONTEXT_PADDING_MINUTES = 60
    mock_config.MAX_WORKERS = 2
    mock_config.CONSECUTIVE_FAIL_THRESHOLD = 5
    mock_config.CONSECUTIVE_FAIL_SKIP_CYCLES = 5
    mock_config.BRIDGE_VERSION = '2.0.0-test'
    mock_config.CYCLE_TIME_ALERT_THRESHOLD = 120
    mock_config.RETRY_ATTEMPTS = 3
    mock_config.validate_env = MagicMock()
    mock_config.setup_logging = MagicMock()
    mock_config.mask_account_id = lambda x: f'***{str(x)[-2:]}'
    monkeypatch.setitem(sys.modules, 'config', mock_config)

    # Mock core module
    mock_core = MagicMock()
    mock_core.supabase = MagicMock()
    mock_core.init_mt5.return_value = True
    mock_core.decrypt_password.side_effect = lambda x: x  # passthrough
    mock_core.send_telegram_message = MagicMock()
    mock_core.TELEGRAM_ADMIN_CHAT_ID = ''
    mock_core.retry_mt5.side_effect = lambda func, *args, **kw: func(*args)
    mock_core.retry_supabase.side_effect = lambda op, **kw: op()
    monkeypatch.setitem(sys.modules, 'core', mock_core)

    # Mock stats module
    mock_stats = MagicMock()
    mock_stats.close_trade_dates_from_rows.return_value = set()
    mock_stats.recompute_daily_stats_for_account = MagicMock()
    monkeypatch.setitem(sys.modules, 'stats', mock_stats)

    # Mock health module
    mock_health = MagicMock()
    mock_health.update_health = MagicMock()
    monkeypatch.setitem(sys.modules, 'health', mock_health)

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
    main.retry_mt5 = mock_core.retry_mt5
    main.retry_supabase = mock_core.retry_supabase
    main.TELEGRAM_ADMIN_CHAT_ID = ''
    main.update_health = mock_health.update_health
    # Reset failure tracking
    main._account_failures.clear()
    main._cycle_count = 0

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
# Symbol normalization
# ===================================================================

class TestSymbolNormalization:
    def test_gold_to_xauusd(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('GOLDm') == 'XAUUSD'

    def test_xauusdm_to_xauusd(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('XAUUSDm') == 'XAUUSD'

    def test_eurusd_unchanged(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('EURUSD') == 'EURUSD'

    def test_silver_to_xagusd(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('SILVER') == 'XAGUSD'

    def test_suffix_pro(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('EURUSDpro') == 'EURUSD'

    def test_suffix_raw(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('EURUSD.raw') == 'EURUSD'

    def test_suffix_hash(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('EURUSD#') == 'EURUSD'

    def test_suffix_micro(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('EURUSDmicro') == 'EURUSD'

    def test_gold_with_suffix(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('GOLDpro') == 'XAUUSD'

    def test_suffix_std(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod.normalize_symbol('EURUSD.std') == 'EURUSD'


# ===================================================================
# Point size
# ===================================================================

class TestGetPointSize:
    def test_from_mt5_symbol_info(self, main_module):
        main_mod, mt5_mock, _ = main_module
        mt5_mock.symbol_info.return_value = SimpleNamespace(point=0.00001)
        assert main_mod.get_point_size('EURUSD') == 0.00001

    def test_fallback_jpy(self, main_module):
        main_mod, mt5_mock, _ = main_module
        mt5_mock.symbol_info.return_value = None
        assert main_mod.get_point_size('USDJPY') == 0.01

    def test_fallback_xauusd(self, main_module):
        main_mod, mt5_mock, _ = main_module
        mt5_mock.symbol_info.return_value = None
        assert main_mod.get_point_size('XAUUSD') == 0.01

    def test_fallback_default(self, main_module):
        main_mod, mt5_mock, _ = main_module
        mt5_mock.symbol_info.return_value = None
        assert main_mod.get_point_size('EURUSD') == 0.0001


# ===================================================================
# Pips calculation with partial closes
# ===================================================================

class TestPipsCalculation:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
            'last_synced_at': None,
        }

    def test_buy_positive_pips(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
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

    def test_partial_close_weighted_price(self, main_module, make_deal):
        """Partial close: 2 exit deals with different volumes should produce weighted avg price."""
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.history_deals_get.return_value = [
            make_deal(entry=0, position_id=300, symbol='EURUSD', type_=0,
                      volume=1.0, price=1.1000, time_=1705312800, profit=0),
            make_deal(entry=1, position_id=300, symbol='EURUSD', type_=1,
                      volume=0.5, price=1.1040, time_=1705314600, profit=20),
            make_deal(entry=1, position_id=300, symbol='EURUSD', type_=1,
                      volume=0.5, price=1.1060, time_=1705316400, profit=30),
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
        # Weighted avg: (1.1040*0.5 + 1.1060*0.5) / 1.0 = 1.105
        assert upserted[0]['close_price'] == 1.105
        assert upserted[0]['profit'] == 50  # 20 + 30

    def test_xauusd_point_size(self, main_module, make_deal):
        main_mod, mt5_mock, mock_sb = main_module
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


# ===================================================================
# Trade type conversion
# ===================================================================

class TestTradeTypeConversion:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
            'last_synced_at': None,
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
            'last_synced_at': None,
        }
        main_mod.sync_client_account(account)

        assert len(upserted) == 1
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
            'last_synced_at': None,
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
        mt5_mock.history_deals_get.return_value = [
            SimpleNamespace(entry=2, position_id=100, symbol='EURUSD',
                            type=0, volume=0, price=0, time=1705312800, profit=100,
                            commission=0, swap=0),
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
            'last_synced_at': None,
        }

    def test_login_failure(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.login.return_value = False
        mt5_mock.last_error.return_value = (-1, 'Auth failed')
        # Override retry_mt5 to actually call the function
        main_mod.retry_mt5 = lambda func, *args, **kw: func(*args)
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
        main_mod.retry_mt5 = lambda func, *args, **kw: func(*args)
        _chain_mock(mock_sb)

        result = main_mod.sync_client_account(self._make_account())
        assert result is False


# ===================================================================
# Trade chart context
# ===================================================================

class TestTradeChartContext:
    def test_build_chart_context_rows(self, main_module):
        main_mod, mt5_mock, _ = main_module
        mt5_mock.copy_rates_range.return_value = [
            {'time': 1705312800, 'open': 1.1, 'high': 1.11, 'low': 1.09, 'close': 1.105},
            {'time': 1705313100, 'open': 1.105, 'high': 1.12, 'low': 1.1, 'close': 1.115},
        ]

        rows = main_mod.build_trade_chart_context_rows(mt5_mock, [{
            'id': 'trade-1',
            'symbol': 'EURUSD',
            'open_time': '2025-01-15T10:00:00Z',
            'close_time': '2025-01-15T10:30:00Z',
        }])

        assert len(rows) == 1
        assert rows[0]['trade_id'] == 'trade-1'
        assert rows[0]['timeframe'] == 'M5'
        assert len(rows[0]['bars']) == 2
        assert rows[0]['bars'][0]['open'] == 1.1

    def test_chart_context_skips_empty_rates(self, main_module):
        main_mod, mt5_mock, _ = main_module
        mt5_mock.copy_rates_range.return_value = []

        rows = main_mod.build_trade_chart_context_rows(mt5_mock, [{
            'id': 'trade-1',
            'symbol': 'EURUSD',
            'open_time': '2025-01-15T10:00:00Z',
            'close_time': '2025-01-15T10:30:00Z',
        }])

        assert rows == []


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
# Per-account failure backoff
# ===================================================================

class TestAccountFailureBackoff:
    def test_no_failures_not_skipped(self, main_module):
        main_mod, _, _ = main_module
        assert main_mod._should_skip_account('acc-1') is False

    def test_skip_after_threshold(self, main_module):
        main_mod, _, _ = main_module
        main_mod._cycle_count = 10
        for _ in range(5):
            main_mod._record_failure('acc-1')
        # Should be skipped for next 5 cycles (until cycle 15)
        assert main_mod._should_skip_account('acc-1') is True

    def test_unskipped_after_cooldown(self, main_module):
        main_mod, _, _ = main_module
        main_mod._cycle_count = 10
        for _ in range(5):
            main_mod._record_failure('acc-1')
        main_mod._cycle_count = 16  # Past skip_until_cycle
        assert main_mod._should_skip_account('acc-1') is False

    def test_success_resets_failures(self, main_module):
        main_mod, _, _ = main_module
        main_mod._cycle_count = 10
        for _ in range(3):
            main_mod._record_failure('acc-1')
        main_mod._record_success('acc-1')
        assert main_mod._should_skip_account('acc-1') is False
        assert 'acc-1' not in main_mod._account_failures


# ===================================================================
# Equity snapshot timing
# ===================================================================

class TestEquitySnapshotTiming:
    def _make_account(self):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 0,
            'last_synced_at': None,
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

        # Also need retry_supabase to actually call the lambda
        main_mod.retry_supabase = lambda op, **kw: op()

        fake_now = datetime(2025, 1, 15, 10, minute, 0, tzinfo=UTC)
        with patch.object(main_mod, 'datetime') as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            mock_dt.fromtimestamp = datetime.fromtimestamp
            main_mod.sync_client_account(self._make_account())

        has_snapshot = 'equity_snapshots' in upsert_tables
        assert has_snapshot == should_snap, \
            f'minute={minute}: expected snapshot={should_snap}, got={has_snapshot}'


# ===================================================================
# Incremental fetch
# ===================================================================

class TestIncrementalFetch:
    def _make_account(self, last_synced_at=None):
        return {
            'id': 'acc-1', 'client_name': 'Test',
            'mt5_account_id': '12345', 'mt5_investor_password': 'pass',
            'mt5_server': 'Demo', 'master_ib_id': 'ib-1', 'sync_count': 5,
            'last_synced_at': last_synced_at,
        }

    def test_first_sync_uses_trade_start(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.positions_get.return_value = []
        mt5_mock.history_deals_get.return_value = []
        _chain_mock(mock_sb)

        main_mod.sync_client_account(self._make_account(last_synced_at=None))

        # history_deals_get should be called with TRADE_START
        call_args = mt5_mock.history_deals_get.call_args[0]
        assert call_args[0] == datetime(2024, 1, 1, tzinfo=UTC)

    def test_subsequent_sync_uses_last_synced(self, main_module):
        main_mod, mt5_mock, mock_sb = main_module
        mt5_mock.positions_get.return_value = []
        mt5_mock.history_deals_get.return_value = []
        _chain_mock(mock_sb)

        last = '2025-03-19T12:00:00Z'
        main_mod.sync_client_account(self._make_account(last_synced_at=last))

        call_args = mt5_mock.history_deals_get.call_args[0]
        # Should be last_synced_at - 1 day
        expected = datetime(2025, 3, 18, 12, 0, tzinfo=UTC)
        assert call_args[0] == expected
