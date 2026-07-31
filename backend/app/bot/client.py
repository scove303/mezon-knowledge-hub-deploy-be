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

# =============================================================
# PATCH: mezon-sdk 1.4.1 `build_params` trả về chuỗi đã encode sẵn
# -> aiohttp encode lần 2 -> URL bị double-encode (%257B) -> 404.
# Bản master đã sửa thành trả về dict thường. Áp dụng lại tại đây.
# Lưu ý: mezon_api.py import trực tiếp tên hàm nên phải patch
# cả thuộc tính của module mezon_api lẫn utils.
# =============================================================
def _patched_build_params(params=None):
    if not params:
        return {}
    return {k: v for k, v in params.items() if v is not None}


mezon_api_utils.build_params = _patched_build_params
mezon_api_module.build_params = _patched_build_params

client = MezonClient(
    client_id=settings.MEZON_BOT_ID,
    api_key=settings.MEZON_BOT_TOKEN,
    enable_logging=True,
    log_level=logging.INFO,
)

# =============================================================
# PATCH: mezon-sdk 1.4.1 bỏ qua field `ws_url` từ auth response
# (gateway socket thật là sock.mezon.ai, không phải api.mezon.ai)
# =============================================================
_ws_url_cache: dict = {}

_original_call_api = MezonApi.call_api


async def _patched_call_api(self, *args, **kwargs):
    raw = await _original_call_api(self, *args, **kwargs)
    if isinstance(raw, dict) and raw.get("ws_url"):
        _ws_url_cache["ws_url"] = raw["ws_url"]
    return raw


MezonApi.call_api = _patched_call_api

_original_initialize_managers = MezonClient.initialize_managers


async def _patched_initialize_managers(self, sock_session):
    # REST API vẫn dùng api_url, chỉ socket dùng ws_url (sock.mezon.ai)
    url_components = parse_url_components(sock_session.api_url)
    ws_url = _ws_url_cache.get("ws_url") or sock_session.api_url
    ws_components = parse_url_components(f"https://{ws_url}")

    self.api_client = MezonApi(
        self.client_id,
        self.api_key,
        f"{url_components['scheme']}://{url_components['hostname']}:{url_components['port']}",
        self.timeout_ms,
    )
    self.socket_manager = SocketManager(
        host=ws_components["hostname"],
        port=ws_components["port"],
        use_ssl=ws_components["use_ssl"],
        api_client=self.api_client,
        event_manager=self.event_manager,
        message_queue=self.message_queue,
        mezon_client=self,
        message_db=self.message_db,
    )
    # PATCH: server khong tra loi envelope ping -> nhieu warning log.
    # Giam tan suat heartbeat xuong 60s.
    self.socket_manager.socket._heartbeat_timeout_ms = 60000
    self.session_manager = SessionManager(
        api_client=self.api_client, session=sock_session
    )
    self.chanel_manager = ChannelManager(
        api_client=self.api_client,
        socket_manager=self.socket_manager,
        session_manager=self.session_manager,
    )

    await self.socket_manager.connect(sock_session)

    if sock_session.token:
        # PATCH: bo qua init_all_dm_channels (REST /v2/channeldesc da bi
        # server go bo -> 404). Bot chi connect socket va nghe su kien.
        await self.socket_manager.connect_socket(sock_session.token)


MezonClient.initialize_managers = _patched_initialize_managers

# =============================================================
# PATCH: connect_socket trong SDK goi list_clans_descs qua REST
# (/v2/clandesc da bi server go bo -> 404). Bo qua, chi join DM.
# =============================================================
_original_connect_socket = SocketManager.connect_socket


async def _patched_connect_socket(self, token):
    clans = [ApiClanDesc(clan_id="0", clan_name="DM", welcome_channel_id="0")]
    await self.join_all_clans(clans, token)


SocketManager.connect_socket = _patched_connect_socket

# =============================================================
# PATCH: WebSocketAdapterPb.connect dung websockets default
# ping_interval=20s, server Mezon khong tra loi protocol ping
# -> connection bi dong sau ~40s (1011 keepalive ping timeout).
# Master SDK set ping_interval=None (chi dung app-level envelope
# ping). Ap dung lai tai day.
# =============================================================
from urllib.parse import quote

import websockets

from mezon.socket.websocket_adapter import WebSocketAdapterPb

_original_adapter_connect = WebSocketAdapterPb.connect


async def _patched_adapter_connect(self, scheme, host, port, create_status, token):
    url = f"{scheme}{host}:{port}/ws?lang=en&status={quote(str(create_status).lower())}&token={quote(token)}&format=protobuf"
    self._socket = await websockets.connect(
        url,
        subprotocols=["protobuf"],
        ping_interval=None,
    )


WebSocketAdapterPb.connect = _patched_adapter_connect
