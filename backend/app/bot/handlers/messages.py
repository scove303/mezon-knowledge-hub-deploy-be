import json
import asyncio
from sqlmodel import Session, select
from mezon.models import ChannelMessageContent
from mezon.protobuf.api import api_pb2

from app.bot.client import client
from app.core.database import engine
from  app.workers.tasks.roadmap_task import process_roadmap_task
from app.core.security import get_password_hash
from app.models.user import User

PREFIX = "/"


async def handle_message(message: api_pb2.ChannelMessage) -> None:
    # 1. Prevent infinite loops from bot's own messages
    if message.sender_id == client.client_id:
        return

    # Log incoming message
    await checklog(message=message)

    # 2. Extract message text safely from JSON string or dict
    text = ""
    if hasattr(message, "content"):
        if isinstance(message.content, dict):
            text = message.content.get("t", "")
        elif isinstance(message.content, str):
            try:
                content_dict = json.loads(message.content)
                text = content_dict.get("t", "")
            except Exception:
                text = message.content

    text = text.strip()

    # 3. Handle /roadmap command
    if text.startswith("/roadmap"):
        content = text[8:].strip()
        
        if not content:
            channel = await client.channels.fetch(message.channel_id)
            await channel.send(content=ChannelMessageContent(t="⚠️ Please provide a topic for the roadmap! Example: `/roadmap Python`"))
            return

        # Get or create User in DB
        with Session(engine) as session:
            db_user = session.exec(
                select(User).where(User.username == message.sender_id)
            ).first()

            if not db_user:
                mezon_user = await client.users.fetch(message.sender_id)
                display_name = getattr(mezon_user, "display_name", None) or message.sender_id

                db_user = User(
                    username=message.sender_id,
                    hashed_password=get_password_hash("default_pass_123"),
                    display_name=display_name,
                    role="USER",
                )
                session.add(db_user)
                session.commit()
                session.refresh(db_user)

            user_id = db_user.id

        # Send instant initial feedback (completes in ~50ms)
        channel = await client.channels.fetch(message.channel_id)
        await channel.send(
            content=ChannelMessageContent(t=f"⏳ Generating roadmap for **'{content}'**... Please wait a moment!")
        )

        # Dispatch heavy task to background worker without blocking WebSocket event loop
        asyncio.create_task(
            process_roadmap_task(
                channel_id=message.channel_id,
                content=content,
                user_id=user_id
            )
        )

    elif text.startswith("/digest"):
        channel = await client.channels.fetch(message.channel_id)
        # TODO: Implement digest logic

    elif text.startswith("/youtube"):
        channel = await client.channels.fetch(message.channel_id)
        # TODO: Implement youtube logic


async def checklog(message: api_pb2.ChannelMessage):
    print(f"[BOT] Message received from sender: {message.sender_id}", flush=True)


