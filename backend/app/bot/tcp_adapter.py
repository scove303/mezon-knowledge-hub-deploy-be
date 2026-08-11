"""Abridged-TCP transport adapter for the Mezon realtime protocol.

mezon-sdk 0.1.0 only ships a WebSocket adapter, but the Mezon server has
moved to an abridged-TCP protocol over TLS (as used by the official
mezon-js SDK, see packages/mezon-sdk/src/transport/abridged_tcp_adapter.ts).

Wire protocol (same framing as the JS SDK):

* TLS connection to the tcp_url host (default port 443).
* Handshake after connect:  [0xef, lenDiv4] + token padded to a multiple
  of 4 bytes (lenDiv4 = padded_len / 4, or extended [0xef, 0x7f, len24le]).
* Outgoing realtime frame:  [lenDiv4] + protobuf envelope padded to 4
  bytes, lenDiv4 = padded_len / 4 (extended [0x7f, len24le] if >= 0x7f).
* Outgoing ping frame:      [0x00, cid_u16be].
* Incoming pong frame:      [0x00, cid_u16be].
* Incoming raw (API) frame: [0xff, cid_u16be, code_u32be, len_u32be, payload].
* Incoming websocket frame: [0x82, ...] (legacy server frames).
"""

import asyncio
import logging
import ssl
from typing import Any, Optional

from mezon.protobuf.rtapi import realtime_pb2
from mezon.protobuf.utils import encode_protobuf

logger = logging.getLogger(__name__)

PREFIX_PONG = 0x00
PREFIX_RAW = 0xFF
PREFIX_EXTENDED = 0x7F
PREFIX_WS = 0x82
PREFIX_HANDSHAKE = 0xEF

RAW_HEADER_LENGTH = 11
MAX_REALTIME_FRAME_LENGTH = 1 << 20
MAX_API_RESPONSE_LENGTH = 16 << 20


class AbridgedTcpAdapter:
    """Drop-in replacement for WebSocketAdapterPb speaking abridged TCP."""

    def __init__(self):
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._socket: Any = self._iterate()

    def is_open(self) -> bool:
        return (
            self._writer is not None
            and not self._writer.is_closing()
            and self._reader is not None
        )

    async def connect(
        self,
        scheme: str,
        host: str,
        port: str,
        create_status: bool,
        token: str,
    ) -> None:
        ctx = ssl.create_default_context()
        self._reader, self._writer = await asyncio.open_connection(
            host, int(port), ssl=ctx, server_hostname=host
        )
        token_bytes = token.encode("utf-8")
        padding = (4 - (len(token_bytes) % 4)) % 4
        payload = token_bytes + b"\x00" * padding
        length_div4 = len(payload) // 4
        if length_div4 < PREFIX_EXTENDED:
            header = bytes([PREFIX_HANDSHAKE, length_div4])
        elif length_div4 > 0xFFFFFF:
            raise ValueError("Handshake token is too large.")
        else:
            header = bytes([PREFIX_HANDSHAKE, PREFIX_EXTENDED]) + length_div4.to_bytes(3, "little")
        self._writer.write(header + payload)
        await self._writer.drain()

    async def send(self, message: realtime_pb2.Envelope) -> None:
        if not self.is_open():
            raise ConnectionError("Socket connection has not been established yet.")
        if message.HasField("ping"):
            cid = int(message.cid)
            frame = bytes([PREFIX_PONG]) + cid.to_bytes(2, "big")
        else:
            data = encode_protobuf(message)
            padding = (4 - (len(data) % 4)) % 4
            payload = data + b"\x00" * padding
            length_div4 = len(payload) // 4
            if length_div4 < PREFIX_EXTENDED:
                frame = bytes([length_div4]) + payload
            elif length_div4 > 0xFFFFFF:
                raise ValueError("Realtime frame is too large.")
            else:
                frame = bytes([PREFIX_EXTENDED]) + length_div4.to_bytes(3, "little") + payload
        self._writer.write(frame)
        await self._writer.drain()

    async def close(self) -> None:
        if self._writer is not None:
            self._writer.close()
            try:
                await self._writer.wait_closed()
            except Exception:
                pass
            self._writer = None

    async def _iterate(self):
        buf = bytearray()
        while True:
            if self._reader is None:
                return
            try:
                chunk = await self._reader.read(65536)
            except (ConnectionError, ssl.SSLError, asyncio.CancelledError):
                return
            if not chunk:
                return
            if not buf and chunk[:5].lower() == b"http/":
                logger.warning("Mezon TCP adapter: server returned HTTP on abridged TCP port")
                return
            buf.extend(chunk)
            consumed = 0
            while consumed < len(buf):
                step = self._decode_frame(bytes(buf[consumed:]))
                if step is None:
                    break
                kind, size, payload = step
                consumed += size
                if kind == "realtime":
                    yield payload
                elif kind == "pong":
                    cid = payload
                    envelope = realtime_pb2.Envelope()
                    envelope.cid = str(cid)
                    envelope.pong.CopyFrom(realtime_pb2.Pong())
                    yield envelope.SerializeToString()
                elif kind == "raw":
                    logger.debug("Mezon TCP adapter: ignoring raw API frame (cid=%s)", payload)
                else:
                    return
            if consumed:
                del buf[:consumed]

    def _decode_frame(self, buffer: bytes):
        first = buffer[0]

        if first == PREFIX_PONG:
            if len(buffer) < 3:
                return None
            return ("pong", 3, int.from_bytes(buffer[1:3], "big"))

        if first == PREFIX_RAW:
            if len(buffer) < RAW_HEADER_LENGTH:
                return None
            payload_length = int.from_bytes(buffer[7:11], "big")
            if payload_length > MAX_API_RESPONSE_LENGTH:
                return ("reset", 0, "raw frame length too large")
            total = RAW_HEADER_LENGTH + payload_length
            if len(buffer) < total:
                return None
            return ("raw", total, int.from_bytes(buffer[1:3], "big"))

        if first < PREFIX_EXTENDED:
            total = 1 + first * 4
            if len(buffer) < total:
                return None
            return ("realtime", total, bytes(buffer[1:total]))

        if first == PREFIX_EXTENDED:
            if len(buffer) < 4:
                return None
            payload_length = int.from_bytes(buffer[1:4], "little") * 4
            if payload_length > MAX_REALTIME_FRAME_LENGTH:
                return ("reset", 0, "extended frame length too large")
            total = 4 + payload_length
            if len(buffer) < total:
                return None
            return ("realtime", total, bytes(buffer[4:total]))

        if first == PREFIX_WS:
            if len(buffer) < 2:
                return None
            second = buffer[1]
            if second & 0x80:
                return ("reset", 0, "masked websocket frame")
            length7 = second & 0x7F
            if length7 < 126:
                header_length, payload_length = 2, length7
            elif length7 == 126:
                if len(buffer) < 4:
                    return None
                header_length, payload_length = 4, int.from_bytes(buffer[2:4], "big")
            else:
                if len(buffer) < 10:
                    return None
                if int.from_bytes(buffer[2:6], "big") != 0:
                    return ("reset", 0, "websocket frame length too large")
                header_length, payload_length = 10, int.from_bytes(buffer[6:10], "big")
            if payload_length > MAX_REALTIME_FRAME_LENGTH:
                return ("reset", 0, "websocket frame length too large")
            total = header_length + payload_length
            if len(buffer) < total:
                return None
            return ("realtime", total, bytes(buffer[header_length:total]))

        return ("reset", 0, f"unexpected lead byte 0x{first:02x}")
