"""
Centralized configuration for the IB Portal Bridge Service.
All constants and environment variables are validated here.
"""

import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# --- Required environment variables ---
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')
MT5_ENCRYPTION_KEY = os.getenv('MT5_ENCRYPTION_KEY', '')

# --- Optional environment variables ---
MT5_PATH = os.getenv('MT5_PATH')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_ADMIN_CHAT_ID = os.getenv('TELEGRAM_ADMIN_CHAT_ID', '')

# --- Sync settings ---
SYNC_INTERVAL = int(os.getenv('SYNC_INTERVAL', '60'))
EQUITY_INTERVAL_MINUTES = int(os.getenv('EQUITY_INTERVAL_MINUTES', '5'))
SERVER_OFFSET = int(os.getenv('SERVER_OFFSET', '10800'))  # 3 hours default
TRADE_START = datetime(2024, 1, 1, tzinfo=timezone.utc)

# --- Smart scheduler (seconds between syncs per tier) ---
TIER_INTERVAL_LIVE = int(os.getenv('TIER_INTERVAL_LIVE', '30'))       # has open positions
TIER_INTERVAL_ACTIVE = int(os.getenv('TIER_INTERVAL_ACTIVE', '120'))  # closed trade < 4h ago
TIER_INTERVAL_NORMAL = int(os.getenv('TIER_INTERVAL_NORMAL', '900'))  # 15 min default
TIER_INTERVAL_IDLE = int(os.getenv('TIER_INTERVAL_IDLE', '1800'))     # 30 min — no recent activity
TIER_INTERVAL_CLOSED = int(os.getenv('TIER_INTERVAL_CLOSED', '3600')) # market closed (weekend)
ACTIVE_TRADE_WINDOW_HOURS = int(os.getenv('ACTIVE_TRADE_WINDOW_HOURS', '4'))

# --- Performance settings ---
MAX_WORKERS = int(os.getenv('MAX_WORKERS', '5'))
RETRY_ATTEMPTS = int(os.getenv('RETRY_ATTEMPTS', '3'))
CONSECUTIVE_FAIL_THRESHOLD = int(os.getenv('CONSECUTIVE_FAIL_THRESHOLD', '5'))
CONSECUTIVE_FAIL_SKIP_CYCLES = int(os.getenv('CONSECUTIVE_FAIL_SKIP_CYCLES', '5'))

# --- Chart context ---
CHART_CONTEXT_TIMEFRAME = 'M5'
CHART_CONTEXT_PADDING_MINUTES = 60

# --- Monitoring ---
BRIDGE_VERSION = '2.0.0'
CYCLE_TIME_ALERT_THRESHOLD = int(os.getenv('CYCLE_TIME_ALERT_THRESHOLD', '120'))

# --- Logging ---
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
LOG_FILE = os.getenv('LOG_FILE', 'bridge.log')
LOG_MAX_BYTES = int(os.getenv('LOG_MAX_BYTES', str(10 * 1024 * 1024)))  # 10MB
LOG_BACKUP_COUNT = int(os.getenv('LOG_BACKUP_COUNT', '5'))


def validate_env():
    """Validate required environment variables. Fail fast if missing."""
    missing = []
    if not SUPABASE_URL:
        missing.append('SUPABASE_URL')
    if not SUPABASE_KEY:
        missing.append('SUPABASE_KEY')
    if missing:
        print(f"FATAL: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
    if not MT5_ENCRYPTION_KEY:
        logging.getLogger('bridge').warning(
            "MT5_ENCRYPTION_KEY not set — passwords will be treated as plaintext"
        )


def setup_logging():
    """Configure structured logging with console + rotating file handler."""
    log_format = '[%(asctime)s] %(levelname)s %(name)s: %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    # Clear existing handlers
    root_logger.handlers.clear()

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    root_logger.addHandler(console)

    # Rotating file handler
    try:
        file_handler = RotatingFileHandler(
            LOG_FILE, maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT
        )
        file_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
        root_logger.addHandler(file_handler)
    except (OSError, PermissionError) as e:
        logging.getLogger('bridge').warning(f"Could not create log file: {e}")

    return logging.getLogger('bridge')


def mask_account_id(account_id: str) -> str:
    """Mask account ID for safe logging: 12345 -> ***45"""
    s = str(account_id)
    if len(s) <= 2:
        return '***'
    return '***' + s[-2:]
