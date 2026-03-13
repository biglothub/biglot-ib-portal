"""
Core initialization: MT5, Supabase, Telegram
Adapted from TSP-Competition bridge/core.py
"""

import os
import MetaTrader5 as mt5
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# Supabase (service role - bypasses RLS)
supabase = create_client(
    os.getenv('SUPABASE_URL', ''),
    os.getenv('SUPABASE_KEY', '')
)

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_ADMIN_CHAT_ID = os.getenv('TELEGRAM_ADMIN_CHAT_ID', '')


def init_mt5():
    """Initialize MetaTrader 5 connection"""
    mt5_path = os.getenv('MT5_PATH')
    if mt5_path:
        initialized = mt5.initialize(mt5_path)
    else:
        initialized = mt5.initialize()

    if not initialized:
        print(f"MT5 init failed: {mt5.last_error()}")
        return False

    print(f"MT5 initialized: {mt5.terminal_info()}")
    return True


def send_telegram_message(chat_id, message):
    """Send Telegram notification"""
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
        print(f"Telegram error: {e}")
