# app/services/ai/client.py
"""
Gemini client dung chung cho cac service AI (summarize, grouping...).
Tach rieng khoi app/services/document/parser.py vi file do gan chat voi
luong roadmap (outline + lesson detail), khong nen tai su dung cheo de
tranh anh huong lan nhau khi sua doi.
"""

import os
import asyncio

from google import genai
from google.genai import types

from app.core.config import settings

api_key = (
    getattr(settings, "GEMINI_API_KEY", None)
    or getattr(settings, "GOOGLE_API_KEY", None)
    or os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
)

if not api_key:
    print("❌ [LỖI] Chưa tìm thấy GEMINI_API_KEY hoặc GOOGLE_API_KEY trong cấu hình!")

client = genai.Client(api_key=api_key)

MODEL_NAME = "gemini-3.5-flash-lite"


async def generate_content_with_retry(
    prompt: str,
    config: "types.GenerateContentConfig" = None,
    system_instruction: str = None,  # Bổ sung tham số nhận system_instruction
    retries: int = 3,
    base_delay: float = 5.0,
):
    """Gợi Gemini kèm retry khi gặp lỗi thoáng qua (503 - quá tải)."""
    if config is None:
        config = types.GenerateContentConfig()[cite: 1]
    
    # Tự động gán system_instruction vào config nếu được truyền riêng
    if system_instruction:
        config.system_instruction = system_instruction[cite: 1, 3]

    last_exc = None
    for attempt in range(retries):
        try:
            return await client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,  # Dữ liệu từ người dùng (user input)
                config=config,    # Cấu hình chứa system_instruction riêng biệt[cite: 1, 3]
            )
        except Exception as e:
            last_exc = e[cite: 1]
            code = getattr(e, "code", None)[cite: 1]
            is_503 = code == 503 or "503" in str(e) or "UNAVAILABLE" in str(e)[cite: 1]
            if is_503 and attempt < retries - 1:
                print(f"⚠️ [Gemini 503] Thử lại lần {attempt + 1}/{retries} sau {base_delay}s...")[cite: 1]
                await asyncio.sleep(base_delay)[cite: 1]
                base_delay *= 2[cite: 1]
            else:
                raise[cite: 1]
    raise last_exc[cite: 1]