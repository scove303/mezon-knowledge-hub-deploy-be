"""Mezon HTTP API rate-limit spacing.

The Mezon API server enforces a minimum interval of ~1s between protobuf
RPC calls (calls closer together return HTTP 403 Forbidden). The vendored
mezon_sdk's rate limiter only limits concurrency, so this subclass adds a
minimum spacing between every HTTP call.
"""

import asyncio
import time

from mezon_sdk.api.mezon_api import MezonApi


class SpacedMezonApi(MezonApi):
    """MezonApi subclass enforcing a minimum interval between HTTP calls."""

    _call_lock = asyncio.Lock()
    _last_call_at = 0.0
    _min_call_interval = 1.1

    async def call_api(self, *args, **kwargs):
        async with SpacedMezonApi._call_lock:
            wait = (
                SpacedMezonApi._last_call_at
                + SpacedMezonApi._min_call_interval
                - time.monotonic()
            )
            if wait > 0:
                await asyncio.sleep(wait)
            try:
                return await super().call_api(*args, **kwargs)
            finally:
                SpacedMezonApi._last_call_at = time.monotonic()
