import asyncio
from mezon import MezonClient
from app.core.config import settings

# Mezon SDK requires both client_id and api_key. We put dummy if client_id not needed or if it's identical
bot_client = MezonClient(
    client_id=settings.MEZON_BOT_ID, # Bot ID từ Mezon Developer Portal
    api_key=settings.MEZON_BOT_TOKEN
)

async def start_mezon_bot():
    import sys
    print("[BOT] Dang khoi dong Mezon Bot...")
    sys.stdout.flush()
    try:
        await bot_client.login()
        print("[BOT] Khoi dong thanh cong! Dang lang nghe Socket Event...")
        sys.stdout.flush()
    except Exception as e:
        print(f"[BOT] Khoi dong that bai: {e}")
        sys.stdout.flush()

# Lắng nghe sự kiện nhắn tin trong kênh
@bot_client.on_channel_message
async def handle_message(message):
    print(f"[BOT] Da nhan tin nhan: {message}")
    
    # Phản hồi lại User (Lưu ý: Tùy thuộc vào version SDK, cách truy cập text có thể thay đổi)
    try:
        channel_id = getattr(message, "channel_id", None)
        text = getattr(message, "content", "")
        if hasattr(text, "t"):
            text = text.t
        if channel_id:
            channel = await bot_client.channels.fetch(channel_id)
            # await channel.send(content=f"Chào bạn, tôi đã nhận được lệnh: '{text}' (Powered by FastAPI)")
    except Exception as e:
        print(f"[BOT] Loi khi phan hoi: {e}")
