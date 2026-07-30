import json
from google import genai
from google.genai import types
from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

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
# PROMPT BƯỚC 2: VIẾT CHI TIẾT 1 BÀI HỌC (W3SCHOOLS / DOCUMENTATION STYLE)
# =====================================================================
LESSON_DETAIL_SYSTEM_PROMPT = """
Bạn là biên tập viên soạn thảo tài liệu kỹ thuật cao cấp (giống phong cách W3Schools, MDN Web Docs, TutorialsPoint).
Nhiệm vụ của bạn là viết một BÀI GIẢNG SIÊU CHI TIẾT, ĐẦY ĐỦ VÀ CHUYÊN SÂU cho bài học được chỉ định.

BẮT BUỘC VIẾT THEO CẤU TRÚC SAU (Độ dài tối thiểu 1.000 - 2.000 từ):

# [Tên Bài Học]

## 1. 🎯 Bức tranh toàn cảnh & Bản chất vấn đề
- Định nghĩa chính xác khái niệm.
- Vấn đề thực tế là gì và tại sao khái niệm/công cụ này lại đời để giải quyết vấn đề đó?
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


async def parse_context_to_structure(topic: str, tavily_context: str,folder_name: str) -> dict:
    """
    Quy trình 2 Bước để tạo ra bộ bài học dày cộp chuẩn W3Schools
    """
    print("  ---> [Bước 1/2] Đang lập khung Lộ trình (10-12 Bài)...")
    
    # BƯỚC 1: Lấy Outline
    outline_prompt = f"Chủ đề: {topic}\nNgữ cảnh Tavily:\n{tavily_context}"
    outline_res = await client.aio.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=outline_prompt,
        config=types.GenerateContentConfig(
            system_instruction=OUTLINE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.3
        )
    )
    
    outline_data = json.loads(outline_res.text)
    lessons_list = outline_data.get("lessons", [])
    
    print(f"  ---> [Bước 1/2] Đã tạo xong Outline gồm {len(lessons_list)} bài. Đang bắt đầu viết chi tiết từng bài...")

    # BƯỚC 2: Vòng lặp sinh chi tiết từng bài
    final_files = []
    for idx, lesson in enumerate(lessons_list, 1):
        lesson_title = lesson["title"]
        lesson_summary = lesson["summary"]
        
        print(f"    [+ Processing] ({idx}/{len(lessons_list)}) Đang soạn thảo chi tiết bài: '{lesson_title}'...")

        detail_prompt = f"""
        Chủ đề tổng thể: {topic}
        Tên bài học hiện tại: {lesson_title}
        Tóm tắt mục tiêu bài này: {lesson_summary}

        Dữ liệu tham khảo bổ sung từ Internet (Tavily Context):
        {tavily_context}

        Hãy soạn thảo bài học này theo phong cách W3Schools siêu chi tiết!
        """

        detail_res = await client.aio.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=detail_prompt,
            config=types.GenerateContentConfig(
                system_instruction=LESSON_DETAIL_SYSTEM_PROMPT,
                temperature=0.4,
                max_output_tokens=8192
            )
        )

        final_files.append({
            "title": lesson_title,
            "text_content": detail_res.text
        })

    print("  ---> [Bước 2/2] Hoàn thành toàn bộ bài học siêu chi tiết!")

    # Trả về đúng cấu trúc JSON mong muốn cho database
    return {
        "folder_name": folder_name,
        "files": final_files
    }