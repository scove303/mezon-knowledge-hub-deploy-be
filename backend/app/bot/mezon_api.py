"""Mezon API compatibility layer.

mezon-sdk 0.1.0 calls the old JSON-REST endpoints (/v2/clandesc, /v2/channeldesc)
which no longer exist on the server. Mezon now exposes protobuf RPC endpoints
(/mezon.api.Mezon/MethodName) accepting protobuf request bodies and returning
protobuf responses. This module re-implements the methods used by the bot
against those RPC endpoints while keeping the SDK's return shapes.
"""

from typing import Any, Optional

import aiohttp
from google.protobuf import json_format

from mezon.api.mezon_api import MezonApi
from mezon.api.utils import build_headers
from mezon.models import (
    ApiChannelDescList,
    ApiChannelDescription,
    ApiClanDescList,
    ApiCreateChannelDescRequest,
)
from mezon.protobuf.api import api_pb2 as api_proto

PROTO_HEADERS = {
    "Accept": "application/proto",
    "Content-Type": "application/proto",
}

RPC_PATHS = {
    "list_clans_descs": "/mezon.api.Mezon/ListClanDescs",
    "list_channel_descs": "/mezon.api.Mezon/ListChannelDescs",
    "create_channel_desc": "/mezon.api.Mezon/CreateChannelDesc",
    "get_channel_detail": "/mezon.api.Mezon/ListChannelDetail",
}


class PatchedMezonApi(MezonApi):
    """MezonApi subclass routing clan/channel calls to the protobuf RPC endpoints."""

    async def _rpc(
        self, path: str, request_msg, response_class, token: str
    ) -> dict:
        headers = build_headers(bearer_token=token)
        headers.update(PROTO_HEADERS)
        body = request_msg.SerializeToString()
        async with aiohttp.ClientSession(timeout=self.client_timeout) as session:
            async with session.post(
                f"{self.base_url}{path}", data=body, headers=headers
            ) as resp:
                resp.raise_for_status()
                raw = await resp.read()
        response = response_class()
        response.ParseFromString(raw)
        return json_format.MessageToDict(response, preserving_proto_field_name=True)

    async def list_clans_descs(
        self,
        token: str,
        limit: Optional[int] = None,
        state: Optional[int] = None,
        cursor: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> ApiClanDescList:
        request = api_proto.ListClanDescRequest(
            limit=limit, state=state, cursor=cursor
        )
        result = await self._rpc(
            RPC_PATHS["list_clans_descs"], request, api_proto.ClanDescList, token
        )
        result.setdefault("clandesc", [])
        return ApiClanDescList.model_validate(result)

    async def list_channel_descs(
        self,
        token: str,
        channel_type: int,
        clan_id: Optional[str] = None,
        limit: Optional[int] = None,
        state: Optional[int] = None,
        cursor: Optional[str] = None,
        options: Optional[dict] = None,
    ) -> ApiChannelDescList:
        request = api_proto.ListChannelDescsRequest(
            channel_type=channel_type,
            clan_id=clan_id,
            limit=limit,
            state=state,
            cursor=cursor,
        )
        result = await self._rpc(
            RPC_PATHS["list_channel_descs"], request, api_proto.ChannelDescList, token
        )
        result.setdefault("channeldesc", [])
        return ApiChannelDescList.model_validate(result)

    async def create_channel_desc(
        self,
        token: str,
        request: ApiCreateChannelDescRequest,
        options: Optional[dict] = None,
    ) -> ApiChannelDescription:
        proto_request = api_proto.CreateChannelDescRequest(
            clan_id=request.clan_id or "",
            parent_id=request.parent_id or "",
            channel_id=request.channel_id or "",
            category_id=request.category_id or "",
            type=request.type,
            channel_label=request.channel_label or "",
            channel_private=request.channel_private,
            user_ids=request.user_ids or [],
        )
        result = await self._rpc(
            RPC_PATHS["create_channel_desc"],
            proto_request,
            api_proto.ChannelDescription,
            token,
        )
        return ApiChannelDescription.model_validate(result)

    async def get_channel_detail(
        self, token: str, channel_id: str
    ) -> ApiChannelDescription:
        request = api_proto.ListChannelDetailRequest(channel_id=channel_id)
        result = await self._rpc(
            RPC_PATHS["get_channel_detail"],
            request,
            api_proto.ChannelDescription,
            token,
        )
        return ApiChannelDescription.model_validate(result)
