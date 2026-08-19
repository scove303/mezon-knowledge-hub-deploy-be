"""
Task 2: Summarize Service & Folder Generator.

Ghep noi dung da crawl tu file + prompt tuy chinh (neu co) cua nguoi
dung thanh 1 prompt chuan, gui qua Gemini de tom tat va tu dong nhom
thanh cau truc {folder_name, documents: [{title, content}]}.
"""

import json
import re

from google.genai import types

from app.services.ai.client import generate_content_with_retry
from app.services.ai.prompts import SUMMARIZE_AND_GROUP_SYSTEM_PROMPT

# Gioi han so ky tu context gui cho model, tranh vuot qua context window
# va tang chi phi khong can thiet cho tai lieu qua dai.
MAX_CONTEXT_CHARS = 60_000


class SummarizeGenerationError(Exception):
    """Loi khi goi model hoac khi model tra ve JSON khong hop le."""


def build_combined_prompt(extracted_text: str, user_prompt: str | None, filename: str) -> str:
    """
    Ghep Context tu File + User Prompt tuy chinh thanh 1 prompt chuan
    gui cho model.

    Neu extracted_text qua dai, cat bot phan giua, giu dau + cuoi tai
    lieu (thuong chua phan mo dau/ket luan quan trong).
    """
    text = extracted_text.strip()
    if len(text) > MAX_CONTEXT_CHARS:
        head = text[: MAX_CONTEXT_CHARS // 2]
        tail = text[-MAX_CONTEXT_CHARS // 2 :]
        text = (
            f"{head}\n\n"
            f"[... đã lược bớt phần giữa tài liệu do quá dài ...]\n\n"
            f"{tail}"
        )

    parts = [f"Tên file gốc: {filename}", "", "NỘI DUNG TÀI LIỆU:", text]

    if user_prompt and user_prompt.strip():
        parts += [
            "",
            "YÊU CẦU TÙY CHỈNH TỪ NGƯỜI DÙNG (ưu tiên bám sát yêu cầu này):",
            user_prompt.strip(),
        ]

    return "\n".join(parts)


def _extract_json(raw_text: str) -> dict:
    """Parse JSON tra ve tu model; thu don sach markdown fence neu co."""
    text = raw_text.strip()
    # Model doi khi boc JSON trong ```json ... ``` du da yeu cau khong lam vay
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    return json.loads(text)


async def summarize_and_group(
    extracted_text: str,
    filename: str,
    user_prompt: str | None = None,
) -> dict:
    """
    Goi Gemini de tom tat + tu dong nhom noi dung thanh cau truc
    Folder/Documents.

    Returns:
        {
            "folder_name": str,
            "documents": [{"title": str, "content": str}, ...]
        }

    Raises:
        SummarizeGenerationError: khi model loi hoac tra ve JSON khong dung dinh dang
    """
    if not extracted_text or not extracted_text.strip():
        raise SummarizeGenerationError("Không có nội dung để tóm tắt")

    combined_prompt = build_combined_prompt(extracted_text, user_prompt, filename)

    try:
        response = await generate_content_with_retry(
            combined_prompt,
            types.GenerateContentConfig(
                system_instruction=SUMMARIZE_AND_GROUP_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
    except Exception as e:
        raise SummarizeGenerationError(f"Lỗi khi gọi model tóm tắt: {str(e)}") from e

    raw_text = (response.text or "").strip()
    if not raw_text:
        raise SummarizeGenerationError("Model trả về nội dung rỗng")

    try:
        data = _extract_json(raw_text)
    except json.JSONDecodeError as e:
        raise SummarizeGenerationError(
            f"Model trả về JSON không hợp lệ: {str(e)}"
        ) from e

    documents = data.get("documents") or []
    if not documents:
        raise SummarizeGenerationError(
            "Model không trả về tài liệu nào (documents rỗng)"
        )

    # Chuan hoa: bo qua document thieu title/content
    normalized_documents = [
        {
            "title": (doc.get("title") or "Tài liệu không tên").strip(),
            "content": (doc.get("content") or "").strip(),
        }
        for doc in documents
        if (doc.get("content") or "").strip()
    ]

    if not normalized_documents:
        raise SummarizeGenerationError(
            "Tất cả tài liệu do model trả về đều rỗng nội dung"
        )

    return {
        "folder_name": (data.get("folder_name") or filename).strip(),
        "documents": normalized_documents,
    }