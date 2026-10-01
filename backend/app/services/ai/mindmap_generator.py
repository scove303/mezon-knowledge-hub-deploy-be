"""
AI Mindmap Generator — Sinh cây sơ đồ tư duy concept-based từ nội dung folder.
"""
import json
import asyncio
from google import genai
from google.genai import types
from app.services.document.parser import client, MODEL_NAME, _generate_content_with_retry


MINDMAP_GENERATION_PROMPT = """
Bạn là Chuyên gia Tổng hợp Kiến thức & Thiết kế Sơ đồ Tư duy (Mindmap Architect).

NHIỆM VỤ: Phân tích nội dung tài liệu dưới đây và tạo ra một CÂY SƠ ĐỒ TƯ DUY (Mindmap)
thể hiện CÁC Ý TƯỞNG, KHÁI NIỆM VÀ MỐI QUAN HỆ CỐT LÕI rút ra từ nội dung thực tế.

⚠️ KHÔNG được dùng tiêu đề bài học, tên mục, hoặc cấu trúc chung chung làm node.
Mỗi node phải là một ý tưởng/khái niệm/thông tin CỤ THỂ được trích từ nội dung.

QUY TẮC CẤU TRÚC CÂY:
1. Node gốc (root): Chủ đề trung tâm tổng quát nhất (2-6 từ)
2. Tầng 1 — Nhánh chính (main): 4-8 ý tưởng/khái niệm lớn nhất (2-8 từ mỗi label)
3. Tầng 2 — Nhánh phụ (sub): 2-5 chi tiết quan trọng cho mỗi nhánh chính (2-10 từ)
4. Tầng 3 — Chi tiết (detail): Thông tin cụ thể, ví dụ, con số, tên riêng (2-12 từ)
5. Tầng 4 — Chi tiết sâu (leaf): Chỉ thêm khi thực sự cần thiết (2-12 từ)
   Tối đa 5 tầng sâu (root + 4 tầng con).

QUY TẮC LABEL — BẮT BUỘC:
✅ TỐT (cụ thể, từ nội dung thực tế):
   "Hololive Production", "Live2D Face Tracking", "Kizuna AI — Tiên phong 2016",
   "Superchat Revenue $100M+", "Python List Comprehension", "DCF Valuation Model"
❌ KHÔNG (chung chung, tên mục):
   "Tổng quan", "Khái niệm cơ bản", "Phương pháp", "Kết luận", "Bài 1", "Mục 2"

QUY TẮC CHẤT LƯỢNG:
- Tổng 15-50 nodes (tùy độ phức tạp nội dung)
- description: 1 câu giải thích ngắn gọn ý nghĩa node đó
- file_id: Mã file_id (lấy từ header BÀI HỌC FILE_ID của bài viết chứa thông tin đó)
- excerpt: Cụm từ 3-6 từ trích NGUYÊN VĂN từ văn bản trong bài viết chứa thông tin này (dùng để định vị chính xác câu/đoạn trong file khi click)
- Ưu tiên thông tin quan trọng, không liệt kê quá nhiều chi tiết vụn vặt
- Nếu nội dung có nhiều files/bài, hãy TỔNG HỢP và NHÓM theo chủ đề, KHÔNG theo bài

TRẢ VỀ JSON ĐÚNG ĐỊNH DẠNG (không code block, không text ngoài JSON):
{
  "root": {
    "label": "Chủ đề trung tâm",
    "description": "Mô tả tổng quan 1 câu",
    "children": [
      {
        "label": "Ý tưởng chính 1",
        "description": "Giải thích ngắn",
        "file_id": "file-xxxx",
        "excerpt": "cụm từ trích nguyên văn",
        "type": "main",
        "children": [
          {
            "label": "Chi tiết A",
            "description": "Giải thích",
            "file_id": "file-xxxx",
            "excerpt": "cụm từ trích nguyên văn",
            "type": "sub",
            "children": []
          }
        ]
      }
    ]
  }
}
"""


async def generate_concept_mindmap(folder_name: str, combined_content: str) -> dict:
    """
    Gọi AI để sinh cây mindmap concept-based từ nội dung folder.
    Trả về dict dạng { root: { label, description, children: [...] } }
    """
    # Use system_instruction to separate system prompt from user content (prevents prompt injection)
    system_instruction = MINDMAP_GENERATION_PROMPT
    
    # User content goes in the main prompt
    user_content = f"""TÊN FOLDER: {folder_name}

NỘI DUNG TÀI LIỆU:
{combined_content}

Hãy phân tích toàn bộ nội dung trên và trả về JSON mindmap theo đúng cấu trúc quy định."""

    try:
        async with asyncio.timeout(120.0):
            response = await _generate_content_with_retry(
                user_content,
                types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                    system_instruction=system_instruction,
                ),
            )
            raw = response.text or "{}"
            data = json.loads(raw)

            # Validate structure
            if "root" not in data:
                # Nếu AI trả về dạng phẳng, bọc lại
                data = {"root": data}

            return data
    except Exception as e:
        print(f"❌ [Mindmap Generator Error]: {e}")
        # Trả về cây rỗng để frontend fallback
        return {
            "root": {
                "label": folder_name or "Mindmap",
                "description": "Không thể tạo mindmap tự động. Đang dùng dữ liệu fallback.",
                "children": [],
            }
        }
