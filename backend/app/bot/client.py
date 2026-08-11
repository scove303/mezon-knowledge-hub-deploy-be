import asyncio
import logging
from typing import Any, Dict

from mezon_sdk import MezonClient
from mezon_sdk.api.mezon_api import MezonApi
from mezon_sdk.api.utils import build_body, build_headers, build_url, parse_url_components
from mezon_sdk.managers.channel import ChannelManager
from mezon_sdk.managers.session import SessionManager
from mezon_sdk.managers.socket import SocketManager
from mezon_sdk.models import ApiAccountApp, ApiAuthenticateRequest, ApiSession
from mezon_sdk.session import Session

from app.bot.mezon_api import SpacedMezonApi
from app.core.config import settings

AUTHENTICATE_PATH = "/v2/apps/authenticate/token"


class MezonBotClient(MezonClient):
    """MezonClient wired for the current Mezon server:
    WebSocket (protobuf) socket transport plus protobuf-RPC HTTP with rate-limit spacing.
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
                    account=ApiAccountApp(
                        appid=str(self.client_id), token=self.api_key
                    )
                )
            ),
            headers=build_headers(basic_auth=(self.client_id, self.api_key)),
        )
        sock_session = Session(ApiSession.model_validate(raw))
        sock_session.tcp_url = raw.get("tcp_url") or raw.get("ws_url")
        return sock_session

    async def initialize_managers(self, sock_session: Session) -> None:
        url_components = parse_url_components(sock_session.api_url, use_ssl=self.use_ssl)
        self.api_client = SpacedMezonApi(
            self.client_id,
            self.api_key,
            build_url(
                url_components["scheme"],
                url_components["hostname"],
                url_components["port"],
            ),
            self.timeout_ms,
        )

        ws_url = getattr(sock_session, "tcp_url", None) or sock_session.ws_url
        ws_host = ws_url.split("://", 1)[-1].split(":", 1)[0]

        if not hasattr(self, "socket_manager"):
            self.socket_manager = SocketManager(
                ws_url=ws_host,
                use_ssl=True,
                api_client=self.api_client,
                event_manager=self.event_manager,
                mezon_client=self,
                message_db=self.message_db,
            )
        else:
            self.socket_manager.api_client = self.api_client

        self.session_manager = SessionManager(
            api_client=self.api_client, session=sock_session
        )
        self.channel_manager = ChannelManager(
            api_client=self.api_client,
            socket_manager=self.socket_manager,
            session_manager=self.session_manager,
        )

        await self.socket_manager.connect(sock_session)

        if sock_session.token:
            await asyncio.gather(
                self.socket_manager.connect_socket(sock_session.token),
                self.channel_manager.init_all_dm_channels(sock_session.token),
            )

    async def login(self, enable_auto_reconnect: bool = True) -> None:
        """Authenticate and start the socket, skipping MMN/ZK blockchain steps."""
        session = await self.get_session()
        await self.initialize_managers(session)

        self._enable_auto_reconnect = enable_auto_reconnect
        self._is_hard_disconnect = False
        self._reconnect_task = None

        if enable_auto_reconnect:
            self._setup_reconnect_handlers()


client = MezonBotClient(
    client_id=settings.MEZON_BOT_ID,
    api_key=settings.MEZON_BOT_TOKEN,
    enable_logging=True,
    log_level=logging.INFO,
)
