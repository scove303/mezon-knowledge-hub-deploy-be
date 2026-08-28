import httpx
from sqlmodel import Session, select

from app.core.database import engine
from app.core.config import settings
from app.models.folder import Folder
from app.models.shared_chat import SharedChat
from app.bot.utils.embeds import build_status_embed, build_error_embed, build_warning_embed
from mezon_sdk.models import ChannelMessageContent, InteractiveMessageProps


API_BASE = getattr(settings, "API_BASE_URL", "http://localhost:8000")


async def share_chat_command(channel, user_id: int, folder_id: str, title: str = "", description: str = ""):
    """Share a folder as a chat via API."""
    try:
        with Session(engine) as session:
            folder = session.get(Folder, folder_id)
            if not folder or folder.user_id != user_id:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_error_embed("❌ Không tìm thấy", f"Thư mục `{folder_id}` không tồn tại hoặc bạn không có quyền")]
                    )
                )
                return
            
            # Get conversation history from roadmap jobs (if any)
            conversation_history = []
            
            payload = {
                "folder_id": folder_id,
                "title": title or f"Chat: {folder.name}",
                "description": description or f"Shared from {folder.name}",
                "topic": folder.name,
                "conversation_history": conversation_history,
                "is_public": True,
            }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {await get_user_token(user_id)}"}
            resp = await client.post(f"{API_BASE}/api/v1/shared-chats", json=payload, headers=headers)
            
            if resp.status_code != 201:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_error_embed("❌ Lỗi chia sẻ", f"Không thể chia sẻ: {resp.text}")]
                    )
                )
                return
            
            data = resp.json().get("data", {})
            share_url = data.get("share_url", "")
            
            embed = InteractiveMessageProps(
                title="✅ Đã chia sẻ chat!",
                description=f"**{data.get('title', 'Shared Chat')}**\n\n🔗 **Link chia sẻ:** {share_url}",
                color="#00BFFF",
                fields=[
                    {"name": "Share Code", "value": f"`{data.get('share_code', '')}`", "inline": True},
                    {"name": "Files", "value": f"{len(folder.files)} bài học", "inline": True},
                ],
                footer={"text": "Mezon Knowledge Bot"},
            )
            
            await channel.send(
                content=ChannelMessageContent(t="", embed=[embed])
            )
    
    except Exception as e:
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_error_embed("❌ Lỗi", f"Lỗi khi chia sẻ: {str(e)}")]
            )
        )


async def import_chat_command(channel, user_id: int, share_code: str, new_name: str = ""):
    """Import a shared chat via API."""
    try:
        payload = {"share_code": share_code}
        if new_name:
            payload["new_folder_name"] = new_name
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {await get_user_token(user_id)}"}
            resp = await client.post(f"{API_BASE}/api/v1/shared-chats/import", json=payload, headers=headers)
            
            if resp.status_code != 200:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_error_embed("❌ Lỗi nhập", f"Không thể nhập chat: {resp.text}")]
                    )
                )
                return
            
            data = resp.json().get("data", {})
            
            embed = InteractiveMessageProps(
                title="✅ Đã nhập chat!",
                description=f"**{data.get('folder_name', 'Imported Folder')}**\n\n📁 **Files:** {data.get('files_count', 0)} bài học",
                color="#00BFFF",
                fields=[
                    {"name": "Folder ID", "value": f"`{data.get('folder_id', '')}`", "inline": True},
                    {"name": "Action", "value": data.get('message', ''), "inline": False},
                ],
                footer={"text": "Mezon Knowledge Bot"},
            )
            
            await channel.send(
                content=ChannelMessageContent(t="", embed=[embed])
            )
    
    except Exception as e:
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_error_embed("❌ Lỗi", f"Lỗi khi nhập chat: {str(e)}")]
            )
        )


async def list_shared_chats_command(channel, user_id: int):
    """List user's shared chats."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {await get_user_token(user_id)}"}
            resp = await client.get(f"{API_BASE}/api/v1/shared-chats/my", headers=headers)
            
            if resp.status_code != 200:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_error_embed("❌ Lỗi", "Không thể lấy danh sách chat đã chia sẻ")]
                    )
                )
                return
            
            data = resp.json().get("data", [])
            
            if not data:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_warning_embed("📭 Chưa có chat nào", "Bạn chưa chia sẻ chat nào. Hãy thử `/share-chat <folder_id>`")]
                    )
                )
                return
            
            builder = InteractiveMessageProps(
                title="📤 Chat đã chia sẻ của bạn",
                description=f"Tổng cộng: **{len(data)}** chat",
                color="#00BFFF",
            )
            
            for chat in data[:10]:
                builder.add_field(
                    name=f"💬 {chat.get('title', 'Untitled')}",
                    value=f"Code: `{chat.get('share_code', '')}` | Nhập: {chat.get('import_count', 0)} | Xem: {chat.get('view_count', 0)}",
                    inline=False
                )
            
            if len(data) > 10:
                builder.add_field(name="...", value=f"Và {len(data) - 10} chat khác", inline=False)
            
            builder.set_footer(text="Mezon Knowledge Bot")
            
            await channel.send(
                content=ChannelMessageContent(t="", embed=[builder])
            )
    
    except Exception as e:
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_error_embed("❌ Lỗi", f"Lỗi khi lấy danh sách: {str(e)}")]
            )
        )


async def browse_public_chats_command(channel, user_id: int):
    """Browse publicly shared chats."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{API_BASE}/api/v1/shared-chats/public?limit=10")
            
            if resp.status_code != 200:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_error_embed("❌ Lỗi", "Không thể tải chat công khai")]
                    )
                )
                return
            
            data = resp.json().get("data", [])
            
            if not data:
                await channel.send(
                    content=ChannelMessageContent(
                        t="",
                        embed=[build_warning_embed("📭 Chưa có chat công khai", "Hãy là người đầu tiên chia sẻ!")]
                    )
                )
                return
            
            builder = InteractiveMessageProps(
                title="🌍 Chat công khai",
                description="Chia sẻ từ cộng đồng",
                color="#00BFFF",
            )
            
            for chat in data[:10]:
                builder.add_field(
                    name=f"💬 {chat.get('title', 'Untitled')}",
                    value=f"👤 {chat.get('creator_display_name') or chat.get('creator_username', 'Unknown')} | 📥 {chat.get('import_count', 0)} nhập\nCode: `{chat.get('share_code', '')}`",
                    inline=False
                )
            
            builder.add_field(
                name="💡 Nhập chat",
                value="Gõ `/import-chat <share_code>` để nhập vào tài khoản của bạn",
                inline=False
            )
            
            builder.set_footer(text="Mezon Knowledge Bot")
            
            await channel.send(
                content=ChannelMessageContent(t="", embed=[builder])
            )
    
    except Exception as e:
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_error_embed("❌ Lỗi", f"Lỗi khi duyệt: {str(e)}")]
            )
        )


async def get_user_token(user_id: int) -> str:
    """Get user's JWT token for API calls. Uses a simple approach - in production use proper token management."""
    from app.core.security import create_access_token
    return create_access_token(user_id)