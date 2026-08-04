import logging
from mezon import MezonClient
from app.core.config import settings

print(settings.MEZON_BOT_ID,settings.MEZON_BOT_TOKEN,flush=True)

client = MezonClient(
    client_id= settings.MEZON_BOT_ID,
    api_key=settings.MEZON_BOT_TOKEN,
    enable_logging=True,
    log_level=logging.INFO,
)



