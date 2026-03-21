"""
Core initialization: MT5, Supabase, Telegram, retry helpers.
"""

import time
import logging
import base64
import MetaTrader5 as mt5
from supabase import create_client
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import (
    SUPABASE_URL, SUPABASE_KEY, MT5_ENCRYPTION_KEY, MT5_PATH,
    TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID,
    RETRY_ATTEMPTS, mask_account_id,
)

log = logging.getLogger('bridge.core')

# Supabase (service role - bypasses RLS)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def init_mt5():
    """Initialize MetaTrader 5 connection."""
    if MT5_PATH:
        initialized = mt5.initialize(MT5_PATH)
    else:
        initialized = mt5.initialize()

    if not initialized:
        log.error(f"MT5 init failed: {mt5.last_error()}")
        return False

    log.info(f"MT5 initialized: {mt5.terminal_info()}")
    return True


def decrypt_password(encoded: str) -> str:
    """Decrypt AES-256-GCM encrypted password."""
    if not MT5_ENCRYPTION_KEY:
        return encoded
    combined = base64.b64decode(encoded)
    if len(combined) < 29:  # 12 IV + 16 tag + 1 min ciphertext
        return encoded
    iv = combined[:12]
    tag = combined[12:28]
    ciphertext = combined[28:]
    aesgcm = AESGCM(bytes.fromhex(MT5_ENCRYPTION_KEY))
    plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
    return plaintext.decode('utf-8')


def send_telegram_message(chat_id, message):
    """Send Telegram notification."""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    try:
        import requests
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(url, json={
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }, timeout=10)
    except Exception as e:
        log.warning(f"Telegram send error: {e}")


def retry_mt5(func, *args, max_retries=None):
    """Retry an MT5 function call with exponential backoff.

    Returns the result on success, or None after all retries exhausted.
    """
    if max_retries is None:
        max_retries = RETRY_ATTEMPTS
    func_name = getattr(func, '__name__', repr(func))
    for attempt in range(max_retries):
        try:
            result = func(*args)
            if result is not None:
                return result
        except Exception as e:
            log.warning(f"MT5 call {func_name} error (attempt {attempt + 1}): {e}")

        if attempt < max_retries - 1:
            delay = 2 ** attempt
            log.debug(f"MT5 retry {func_name} in {delay}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(delay)
            # Re-initialize MT5 connection before retry
            try:
                mt5.initialize()
            except Exception:
                pass

    log.error(f"MT5 call {func_name} failed after {max_retries} attempts")
    return None


def retry_supabase(operation, description="supabase operation", max_retries=None):
    """Retry a Supabase operation with exponential backoff.

    `operation` is a callable that returns the execute() result.
    """
    if max_retries is None:
        max_retries = RETRY_ATTEMPTS
    last_error = None
    for attempt in range(max_retries):
        try:
            return operation()
        except Exception as e:
            last_error = e
            error_str = str(e)
            # Non-retryable errors
            if any(code in error_str for code in ['400', '409', '422']):
                log.error(f"Supabase non-retryable error ({description}): {e}")
                raise
            if attempt < max_retries - 1:
                delay = 2 ** attempt
                log.warning(f"Supabase retry {description} in {delay}s (attempt {attempt + 1}): {e}")
                time.sleep(delay)

    log.error(f"Supabase {description} failed after {max_retries} attempts: {last_error}")
    raise last_error
