import asyncio
import logging
from mezon import MezonClient
import mezon.api.mezon_api as mezon_api_module
from mezon.api.mezon_api import MezonApi
from mezon.api import utils as mezon_api_utils
from mezon.api.utils import parse_url_components
from mezon.managers.channel import ChannelManager
from mezon.managers.session import SessionManager
from mezon.managers.socket import SocketManager
from mezon.models import ApiClanDesc
from app.core.config import settings

print(settings.MEZON_BOT_ID, settings.MEZON_BOT_TOKEN, flush=True)


client = MezonClient(
    client_id=settings.MEZON_BOT_ID,
    api_key=settings.MEZON_BOT_TOKEN,
    enable_logging=True,
    log_level=logging.INFO,
)

