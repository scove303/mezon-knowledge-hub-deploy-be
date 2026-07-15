import asyncio
from app.core.config import settings
from mezon.client import MezonClient

client = MezonClient(settings.MEZON_BOT_ID, settings.MEZON_BOT_TOKEN)

try:
    asyncio.run(client.login())
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")
