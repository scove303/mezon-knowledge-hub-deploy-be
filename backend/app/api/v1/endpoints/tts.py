"""Endpoint phát âm thanh TTS tiếng Việt (Edge TTS) — thay thế proxy thứ 3 không còn hoạt động."""
import hashlib
import io
from pathlib import Path

import edge_tts
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.api.deps import CurrentActor

router = APIRouter()

CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "tts_cache"
MAX_TEXT_LEN = 1500


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LEN)
    voice: str = "vi-VN-HoaiMyNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"


def _cache_key(text: str, voice: str, rate: str, pitch: str) -> str:
    raw = f"{voice}|{rate}|{pitch}|{text}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


@router.post("")
async def generate_speech(
    body: TTSRequest,
    actor: CurrentActor,
) -> Response:
    """Sinh audio MP3 từ văn bản tiếng Việt bằng Edge TTS (kết nối trực tiếp Microsoft)."""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Văn bản trống")

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = _cache_key(text, body.voice, body.rate, body.pitch)
    cache_file = CACHE_DIR / f"{key}.mp3"

    if not cache_file.exists():
        try:
            communicate = edge_tts.Communicate(
                text,
                voice=body.voice,
                rate=body.rate,
                pitch=body.pitch,
            )
            # Sinh trực tiếp vào buffer để trả về client mà không ghi tạm ra đĩa
            buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buffer.write(chunk["data"])
            cache_file.write_bytes(buffer.getvalue())
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Không thể gọi dịch vụ Edge TTS: {e}",
            )

    return Response(
        content=cache_file.read_bytes(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )