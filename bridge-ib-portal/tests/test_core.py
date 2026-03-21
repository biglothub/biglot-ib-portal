"""Tests for core.py — decrypt_password, init_mt5, send_telegram_message, retry helpers.

core.py has side effects at import time (import config, create_client, import MetaTrader5).
We patch sys.modules and env vars before importing.
"""
from __future__ import annotations

import base64
import importlib
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# ---------------------------------------------------------------------------
# Module-level setup: patch sys.modules so core.py can be imported safely
# ---------------------------------------------------------------------------

@pytest.fixture
def core_module(mt5_mock, monkeypatch):
    """Import core.py with mocked MetaTrader5, config, and supabase."""
    # Ensure MT5 is mocked
    monkeypatch.setitem(sys.modules, 'MetaTrader5', mt5_mock)

    # Mock config module
    mock_config = MagicMock()
    mock_config.SUPABASE_URL = 'https://test.supabase.co'
    mock_config.SUPABASE_KEY = 'test-key'
    mock_config.MT5_ENCRYPTION_KEY = ''
    mock_config.MT5_PATH = None
    mock_config.TELEGRAM_BOT_TOKEN = ''
    mock_config.TELEGRAM_ADMIN_CHAT_ID = ''
    mock_config.RETRY_ATTEMPTS = 3
    mock_config.mask_account_id = lambda x: f'***{str(x)[-2:]}'
    monkeypatch.setitem(sys.modules, 'config', mock_config)

    # Mock supabase.create_client
    fake_supabase_mod = MagicMock()
    fake_supabase_mod.create_client.return_value = MagicMock()
    monkeypatch.setitem(sys.modules, 'supabase', fake_supabase_mod)

    # Set required env vars
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_KEY', 'test-key')
    monkeypatch.setenv('MT5_ENCRYPTION_KEY', '')
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', '')
    monkeypatch.setenv('TELEGRAM_ADMIN_CHAT_ID', '')

    # Force reimport
    if 'core' in sys.modules:
        del sys.modules['core']

    import core
    yield core

    # Cleanup
    if 'core' in sys.modules:
        del sys.modules['core']


# ---------------------------------------------------------------------------
# Helper: encrypt a plaintext for round-trip testing
# ---------------------------------------------------------------------------

def _encrypt_for_test(plaintext: str, hex_key: str) -> str:
    """Encrypt with AES-256-GCM in the format expected by decrypt_password."""
    key = bytes.fromhex(hex_key)
    iv = os.urandom(12)
    aesgcm = AESGCM(key)
    encrypted = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
    # encrypted = ciphertext + tag (16 bytes)
    tag = encrypted[-16:]
    ciphertext = encrypted[:-16]
    combined = iv + tag + ciphertext  # format: iv(12) + tag(16) + ciphertext(N)
    return base64.b64encode(combined).decode('utf-8')


# ===================================================================
# decrypt_password
# ===================================================================

class TestDecryptPassword:
    TEST_KEY = 'a' * 64  # 32-byte key in hex

    def test_no_key_returns_raw(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'MT5_ENCRYPTION_KEY', '')
        result = core_module.decrypt_password('some-raw-password')
        assert result == 'some-raw-password'

    def test_short_payload_returns_raw(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'MT5_ENCRYPTION_KEY', self.TEST_KEY)
        # base64 of < 29 bytes
        short = base64.b64encode(b'short').decode()
        result = core_module.decrypt_password(short)
        assert result == short

    def test_valid_roundtrip(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'MT5_ENCRYPTION_KEY', self.TEST_KEY)
        plaintext = 'MySecretPass123'
        encoded = _encrypt_for_test(plaintext, self.TEST_KEY)
        result = core_module.decrypt_password(encoded)
        assert result == plaintext

    def test_invalid_payload_raises(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'MT5_ENCRYPTION_KEY', self.TEST_KEY)
        # 29+ bytes of garbage
        garbage = base64.b64encode(os.urandom(40)).decode()
        with pytest.raises(Exception):
            core_module.decrypt_password(garbage)


# ===================================================================
# init_mt5
# ===================================================================

class TestInitMt5:
    def test_success(self, core_module, mt5_mock):
        mt5_mock.initialize.return_value = True
        result = core_module.init_mt5()
        assert result is True
        mt5_mock.initialize.assert_called_once()

    def test_failure(self, core_module, mt5_mock):
        mt5_mock.initialize.return_value = False
        mt5_mock.last_error.return_value = (-1, 'Failed')
        result = core_module.init_mt5()
        assert result is False

    def test_with_path(self, core_module, mt5_mock, monkeypatch):
        monkeypatch.setattr(core_module, 'MT5_PATH', '/path/to/mt5')
        result = core_module.init_mt5()
        assert result is True


# ===================================================================
# send_telegram_message
# ===================================================================

class TestSendTelegramMessage:
    def test_no_token(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'TELEGRAM_BOT_TOKEN', '')
        with patch('requests.post') as mock_post:
            core_module.send_telegram_message('12345', 'hello')
            mock_post.assert_not_called()

    def test_no_chat_id(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'TELEGRAM_BOT_TOKEN', 'some-token')
        with patch('requests.post') as mock_post:
            core_module.send_telegram_message('', 'hello')
            mock_post.assert_not_called()

    def test_success(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'TELEGRAM_BOT_TOKEN', 'bot-token-123')
        with patch.dict(sys.modules, {'requests': MagicMock()}) as _:
            import requests
            core_module.send_telegram_message('chat-42', 'test message')
            requests.post.assert_called_once()
            call_args = requests.post.call_args
            assert 'bot-token-123' in call_args[0][0]
            assert call_args[1]['json']['chat_id'] == 'chat-42'
            assert call_args[1]['json']['text'] == 'test message'

    def test_exception_swallowed(self, core_module, monkeypatch):
        monkeypatch.setattr(core_module, 'TELEGRAM_BOT_TOKEN', 'bot-token')
        with patch.dict(sys.modules, {'requests': MagicMock()}) as _:
            import requests
            requests.post.side_effect = ConnectionError('network error')
            # Should not raise
            core_module.send_telegram_message('chat-42', 'test')


# ===================================================================
# retry_mt5
# ===================================================================

class TestRetryMt5:
    def test_success_first_try(self, core_module):
        mock_func = MagicMock(return_value='result')
        result = core_module.retry_mt5(mock_func, 'arg1')
        assert result == 'result'
        assert mock_func.call_count == 1

    def test_success_after_retry(self, core_module):
        mock_func = MagicMock(side_effect=[None, 'result'])
        with patch('time.sleep'):
            result = core_module.retry_mt5(mock_func, max_retries=3)
        assert result == 'result'
        assert mock_func.call_count == 2

    def test_all_retries_exhausted(self, core_module):
        mock_func = MagicMock(return_value=None)
        with patch('time.sleep'):
            result = core_module.retry_mt5(mock_func, max_retries=3)
        assert result is None
        assert mock_func.call_count == 3

    def test_exception_retried(self, core_module):
        mock_func = MagicMock(side_effect=[RuntimeError('oops'), 'ok'])
        with patch('time.sleep'):
            result = core_module.retry_mt5(mock_func, max_retries=3)
        assert result == 'ok'


# ===================================================================
# retry_supabase
# ===================================================================

class TestRetrySupabase:
    def test_success_first_try(self, core_module):
        op = MagicMock(return_value='data')
        result = core_module.retry_supabase(op, description='test')
        assert result == 'data'
        assert op.call_count == 1

    def test_retries_on_network_error(self, core_module):
        op = MagicMock(side_effect=[ConnectionError('timeout'), 'data'])
        with patch('time.sleep'):
            result = core_module.retry_supabase(op, description='test', max_retries=3)
        assert result == 'data'
        assert op.call_count == 2

    def test_no_retry_on_400(self, core_module):
        op = MagicMock(side_effect=Exception('400 Bad Request'))
        with pytest.raises(Exception, match='400'):
            core_module.retry_supabase(op, description='test', max_retries=3)
        assert op.call_count == 1

    def test_all_retries_exhausted_raises(self, core_module):
        op = MagicMock(side_effect=ConnectionError('timeout'))
        with patch('time.sleep'):
            with pytest.raises(ConnectionError):
                core_module.retry_supabase(op, description='test', max_retries=2)
        assert op.call_count == 2
