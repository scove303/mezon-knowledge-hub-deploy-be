import asyncio
from app.core.config import settings
from app.bot.client import client as bot_client
from app.bot.handlers.messages import handle_message

# Mezon SDK requires both client_id and api_key. We put dummy if client_id not needed or if it's identical

# Register the handler
bot_client.on_channel_message(handler=handle_message)

async def start_mezon_bot():
    import sys
    print("[BOT] Dang khoi dong Mezon Bot...")
    sys.stdout.flush()
    try:
        await bot_client.login()
        print("[BOT] Khoi dong thanh cong! Dang lang nghe Socket Event...")
        sys.stdout.flush()
        await asyncio.Event().wait()
    except Exception as e:
        print(f"[BOT] Khoi dong that bai: {e}")
        sys.stdout.flush()

# Lắng nghe sự kiện nhắn tin trong kênh
