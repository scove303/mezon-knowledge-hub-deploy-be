import asyncio
import logging
from typing import Any, Dict

from mezon import MezonClient
from mezon.api.mezon_api import MezonApi
from mezon.api.utils import build_body, build_headers, parse_url_components
from mezon.managers.channel import ChannelManager
from mezon.managers.session import SessionManager
from mezon.managers.socket import SocketManager
from mezon.models import ApiAccountApp, ApiAuthenticateRequest
from mezon.session import Session

from app.core.config import settings

AUTHENTICATE_PATH = "/v2/apps/authenticate/token"


class _RawApiSession:
    """Shim of the ApiSession fields plus ws_url (dropped by the SDK 1.4.1 model)."""

    def __init__(self, data: Dict[str, Any]):
        self.token = data.get("token")
        self.refresh_token = data.get("refresh_token")
        self.user_id = data.get("user_id")
        self.api_url = data.get("api_url")
        self.ws_url = data.get("ws_url")


class MezonBotClient(MezonClient):
    """
    mezon-sdk 1.4.1 bug workaround: the authenticate response carries both
    api_url (https://api.mezon.ai) and ws_url (sock.mezon.ai), but the SDK
    keeps only api_url and uses it for the socket host as well, which makes
    the WebSocket upgrade fail with HTTP 404. Keep REST on api_url and
    connect the socket to ws_url instead.
    """

    async def get_session(self) -> Session:
        temp_session_manager = SessionManager(
            api_client=MezonApi(
                self.client_id,
                self.api_key,
                self.login_url,
                self.timeout_ms,
            )
        )
        raw = await temp_session_manager.api_client.call_api(
            method="POST",
            url_path=AUTHENTICATE_PATH,
            query_params={},
            body=build_body(
                ApiAuthenticateRequest(
                    account=ApiAccountApp(appid=self.client_id, token=self.api_key)
                )
            ),
            headers=build_headers(basic_auth=(self.client_id, self.api_key)),
        )
        sock_session = Session(_RawApiSession(raw))
        sock_session.ws_url = raw.get("ws_url")
        return sock_session

    async def initialize_managers(self, sock_session: Session) -> None:
        url_components = parse_url_components(sock_session.api_url)
        self.api_client = MezonApi(
            self.client_id,
            self.api_key,
            f"{url_components['scheme']}://{url_components['hostname']}:{url_components['port']}",
            self.timeout_ms,
        )

        ws_components = url_components
        ws_url = getattr(sock_session, "ws_url", None)
        if ws_url:
            # parse_url_components only understands https/wss schemes
            ws_components = parse_url_components(
                ws_url if ws_url.startswith(("http://", "https://")) else f"https://{ws_url}"
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
            await asyncio.gather(
                self.socket_manager.connect_socket(sock_session.token),
                self.chanel_manager.init_all_dm_channels(sock_session.token),
            )


client = MezonBotClient(
    client_id=settings.MEZON_BOT_ID,
    api_key=settings.MEZON_BOT_TOKEN,
    enable_logging=True,
    log_level=logging.INFO,
)
