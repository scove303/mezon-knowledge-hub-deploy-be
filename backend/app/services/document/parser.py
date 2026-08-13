import os
import json
import asyncio
import traceback
from google import genai
from google.genai import types
from app.core.config import settings

# 1. Lấy Google API Key từ Config / Env
api_key = (
    getattr(settings, "GEMINI_API_KEY", None)
    or getattr(settings, "GOOGLE_API_KEY", None)
    or os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
)

if not api_key:
    print("❌ [LỖI] Chưa tìm thấy GEMINI_API_KEY hoặc GOOGLE_API_KEY trong cấu hình!")

# 2. Khởi tạo Google GenAI Client
client = genai.Client(api_key=api_key)


MODEL_NAME = "gemini-3.5-flash-lite"




# =====================================================================
# PROMPT BƯỚC 1: LẬP CÂY LỘ TRÌNH (OUTLINE)
# =====================================================================
OUTLINE_SYSTEM_PROMPT = """
Bạn là Kiến trúc sư Chương trình Giảng dạy (Curriculum Architect).
Dựa trên thông tin ngữ cảnh thu thập (Tavily Context), hãy thiết kế một Cây Lộ Trình Học Tập từ cơ bản đến nâng cao cho chủ đề được yêu cầu.

YÊU CẦU:
1. Tạo danh sách BẮT BUỘC từ 10 đến 12 Bài học theo thứ tự logic.
2. Trả về đúng định dạng JSON:
{
  "folder_name": "Tên Lộ trình Học tập Toàn diện",
  "lessons": [
    {"title": "Bài 1: [Tên bài học]", "summary": "Tóm tắt 1-2 câu về nội dung bài này"},
    {"title": "Bài 2: [Tên bài học]", "summary": "Tóm tắt 1-2 câu..."}
  ]
}
"""

# =====================================================================
# PROMPT BƯỚC 2: VIẾT CHI TIẾT 1 BÀI HỌC
# =====================================================================
LESSON_DETAIL_SYSTEM_PROMPT = """
Bạn là biên tập viên soạn thảo tài liệu kỹ thuật cao cấp (giống phong cách W3Schools, MDN Web Docs, TutorialsPoint).
Nhiệm vụ của bạn là viết một BÀI GIẢNG SIÊU CHI TIẾT, ĐẦY ĐỦ VÀ CHUYÊN SÂU cho bài học được chỉ định.

BẮT BUỘC VIẾT THEO CẤU TRÚC SAU (Độ dài tối thiểu 1.000 - 2.000 từ):

# [Tên Bài Học]

## 1. 🎯 Bức tranh toàn cảnh & Bản chất vấn đề
- Định nghĩa chính xác khái niệm.
- Vấn đề thực tế là gì và tại sao khái niệm/công cụ này ra đời để giải quyết vấn đề đó?
- So sánh ngắn gọn với các giải pháp khác (nếu có).

## 2. 📖 Cú pháp chuẩn & Khai phá chi tiết các Khái niệm con
- **Cú pháp / Công thức gốc (Syntax / Formula):** Trình bày dạng code/block rõ ràng.
- **Bảng chi tiết Tham số / Thành phần (Parameters / Components breakdown):**
  | Tên Tham số/Thành phần | Kiểu dữ liệu / Kiểu giá trị | Mặc định | Ý nghĩa & Cách hoạt động chi tiết |
  | --- | --- | --- | --- |
- **Giải thích sâu từng thuật ngữ/khái niệm nhỏ bên trong:** Đào sâu từng khía cạnh, không bỏ sót chi tiết nào.

## 3. 🛠️ Danh sách các Thuộc tính / Phương thức / Quy tắc liên quan
(Liệt kê đầy đủ các thuộc tính, hàm, hoặc biến thể phổ biến nhất)
- `Khái niệm/Hàm A`: Giải thích chi tiết + ví dụ nhỏ.
- `Khái niệm/Hàm B`: Giải thích chi tiết + ví dụ nhỏ.
- `Khái niệm/Hàm C`: Giải thích chi tiết + ví dụ nhỏ.

## 4. 💻 Ví dụ minh họa thực tế (Full Working Example)
- Đưa ra bài toán thực tế hoàn chỉnh (Sử dụng code có comment từng dòng HOẶC các mẫu kịch bản/Case Study chi tiết).
- **Kết quả đầu ra (Output / Expected Result):** Mô tả chi tiết kết quả trả về.
- **Giải thích từng bước (Step-by-step Explanation):** Đánh số 1, 2, 3 giải thích tại sao dòng/bước đó lại chạy như vậy.

## 5. ⚠️ Mẹo chuyên nghiệp, Lỗi thường gặp & Edge Cases (Best Practices & Pitfalls)
- 3-5 Lỗi phổ biến nhất mà người mới hay gặp phải (Kèm cách khắc phục).
- Lưu ý về hiệu năng, tối ưu hóa hoặc quy chuẩn khi làm dự án thực tế.

## 6. 🧪 Bài tập thực hành nâng cao (Có đáp án / Hướng dẫn giải)
- **Bài tập 1 (Cơ bản):** Yêu cầu + Hướng dẫn.
- **Bài tập 2 (Nâng cao):** Yêu cầu + Lời giải/Code mẫu chi tiết.
"""


async def _generate_content_with_retry(
    prompt: str,
    config,
    retries: int = 3,
    base_delay: float = 5.0,
):
    """Gọi Gemini kèm retry khi gặp lỗi thoáng qua (503 high demand)."""
    last_exc = None
    for attempt in range(retries):
        try:
            return await client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=config,
            )
        except Exception as e:
            last_exc = e
            code = getattr(e, "code", None)
            is_503 = code == 503 or "503" in str(e) or "UNAVAILABLE" in str(e)
            if is_503:
                print(f"⚠️ [Gemini 503] Thử lại lần {attempt + 1}/{retries} sau {base_delay}s...")
                await asyncio.sleep(base_delay)
                base_delay *= 2
            else:
                raise
    raise last_exc


async def generate_single_lesson(topic: str, lesson: dict, tavily_context: str, idx: int, total: int,semaphore) -> dict:
    """Sinh chi tiết từng bài học trực tiếp qua Google GenAI SDK (Async)"""
    async with semaphore:
        lesson_title = lesson["title"]
        lesson_summary = lesson["summary"]
        
        print(f"    [+ Processing] ({idx}/{total}) Đang soạn bài với Gemini Flash: '{lesson_title}'...")

        detail_prompt = f"""
        Chủ đề tổng thể: {topic}
        Tên bài học hiện tại: {lesson_title}
        Tóm tắt mục tiêu bài này: {lesson_summary}

        Dữ liệu tham khảo bổ sung từ Internet (Tavily Context):
        {tavily_context}

        Hãy soạn thảo bài học này theo phong cách W3Schools siêu chi tiết!
        """

        try:
            async with asyncio.timeout(180.0):
                # Gọi API thông qua client.aio (Async Client) kèm retry 503
                response = await _generate_content_with_retry(
                    detail_prompt,
                    types.GenerateContentConfig(
                        system_instruction=LESSON_DETAIL_SYSTEM_PROMPT,
                        temperature=0.4,
                    ),
                )
                
                text_content = response.text or ""

                if not text_content.strip():
                    raise ValueError("Google GenAI API trả về nội dung rỗng (Empty content)")

        except Exception as e:
            print(f"❌ [LỖI Gemini Flash bài '{lesson_title}']: {e}")
            traceback.print_exc()
            text_content = f"# {lesson_title}\n\n*Nội dung bài học này đang được bổ sung.*"

        return {
            "title": lesson_title,
            "text_content": text_content
        }


async def parse_context_to_structure(
    topic: str,
    tavily_context: str,
    folder_name: str,
    on_event: callable = None,
) -> dict:
    """
    Quy trình 2 Bước Async sử dụng Google GenAI SDK.
    on_event: callback nhận dict sự kiện để stream tiến trình ra ngoài (SSE).
    """
    #  tạo semarphore mới
    semaphore = asyncio.Semaphore(5)



    print("  ---> [Bước 1/2] Đang lập khung Lộ trình với Gemini Flash...")
    if on_event:
        on_event({"type": "status", "message": "Đang lập khung lộ trình với Gemini..."})

    outline_prompt = f"Chủ đề: {topic}\nNgữ cảnh Tavily:\n{tavily_context}"

    outline_res = await _generate_content_with_retry(
        outline_prompt,
        types.GenerateContentConfig(
            system_instruction=OUTLINE_SYSTEM_PROMPT,
            response_mime_type="application/json",  # Ép trả về JSON chuẩn
            temperature=0.3,
        ),
    )

    raw_json = outline_res.text or "{}"
    outline_data = json.loads(raw_json)
    lessons_list = outline_data.get("lessons", [])
    total_lessons = len(lessons_list)

    print(f"  ---> [Bước 1/2] Đã tạo xong Outline gồm {total_lessons} bài. Đang bắt đầu viết chi tiết...")
    if on_event:
        on_event({"type": "outline", "total": total_lessons})

    # BƯỚC 2: Sinh các bài học đồng thời — phát sự kiện ngay khi từng bài hoàn thành
    # (dùng done-callback thay vì as_completed: as_completed trả coroutine, không phải task)
    final_files = [None] * total_lessons
    lesson_tasks: dict = {}

    def _on_lesson_done(task):
        idx, title = lesson_tasks[task]
        result = task.result()
        final_files[idx - 1] = result
        print(f"    [Event] Bài {idx}/{total_lessons} xong: '{title}'")
        if on_event:
            on_event({
                "type": "lesson",
                "idx": idx,
                "total": total_lessons,
                "title": title,
                "content": result.get("text_content", ""),
            })

    for idx, lesson in enumerate(lessons_list, 1):
        task = asyncio.create_task(
            generate_single_lesson(topic, lesson, tavily_context, idx, total_lessons,semaphore=semaphore)
        )
        lesson_tasks[task] = (idx, lesson.get("title", f"Bài {idx}"))
        task.add_done_callback(_on_lesson_done)

    await asyncio.gather(*lesson_tasks.keys(), return_exceptions=True)

    print("  ---> [Bước 2/2] Hoàn thành toàn bộ bài học siêu chi tiết!")

    return {
        "folder_name": folder_name,
        "files": final_files,
    }