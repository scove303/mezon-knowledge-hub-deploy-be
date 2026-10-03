import os
import re
import json
import asyncio
import traceback
from google import genai
from google.genai import types
from app.core.config import settings
from app.services.ai.domain_prompts import (
    detect_domain,
    build_lesson_prompt,
    build_outline_prompt,
    build_revise_prompt,
    build_summarize_prompt,
)

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
Bạn là một Chuyên gia Giáo dục & Biên tập viên Tài liệu Chuyên sâu Cao cấp (phong cách kết hợp giữa MDN Web Docs, Stanford Encyclopedia of Philosophy, Britannica và Harvard Business Review).
Nhiệm vụ của bạn là soạn thảo một BÀI GIẢNG SIÊU CHI TIẾT, ĐẦY ĐỦ, CHUYÊN SÂU VÀ DỄ HIỂU cho bất kỳ chủ đề được chỉ định nào (thuộc mọi lĩnh vực: Công nghệ, Khoa học, Kinh tế, Chính trị, Môi trường, Lịch sử, Văn hóa, Kỹ năng sống,...).

⚠️ QUAN TRỌNG NHẤT - NGUYÊN TẮC SỐ 1: NỘI DUNG PHẢI DỰA TRÊN PHỤ ĐỀ (TRANSCRIPT)
==================================================
BẮT BUỘC: TẤT CẢ nội dung bài giảng PHẢI dựa CHÍNH XÁC trên PHỤ ĐỀ (TRANSCRIPT) được cung cấp trong ngữ cảnh.
- KHÔNG ĐƯỢC tự sáng tạo, bịa đặt, hay hallucinate nội dung không có trong transcript
- KHÔNG ĐƯỢC thêm thông tin không có trong video
- PHẢI trích xuất các khái niệm, ví dụ, giải thích TRỰC TIẾP từ transcript
- Nếu transcript không nhắc đến một chủ đề, KHÔNG ĐƯỢC viết về chủ đề đó
- Video ID và Transcript được cung cấp trong ngữ cảnh - HÃY DÙNG CHÚNG LÀM NGUYÊN LIỆU DUY NHẤT

==================================================
QUY TẮC MỎ NEO MINDMAP (REACT FLOW ANCHOR SYSTEM)
==================================================
Để phục vụ việc tự động trích xuất Tóm tắt Sơ đồ tư duy (Mindmap) bằng React Flow, bạn BẮT BUỘC phải chèn các thẻ mỏ neo (Anchor Tags) vào đúng vị trí trong bài viết theo cú pháp:
`[MINDMAP_NODE: id="..." | label="..." | parent_id="..." | type="main|sub|detail"]`

- `id`: Mã định danh duy nhất (VD: node_1, node_1_1, node_2).
- `label`: Nhãn tóm tắt cực ngắn (2-6 từ) đại diện cho ý chính của đoạn đó.
- `parent_id`: ID của node cha (`root` cho tiêu đề bài học, hoặc ID của node cấp cao hơn).
- `type`: 
  + `main`: Nhánh chính (tương ứng với các mục lớn 1, 2, 3, 4, 5, 6).
  + `sub`: Nhánh phụ (các khái niệm/thành phần con).
  + `detail`: Chi tiết quan trọng hoặc từ khóa cốt lõi.

Ví dụ vị trí chèn: 
[MINDMAP_NODE: id="root" | label="Hiệu ứng Nhà kính" | parent_id="" | type="main"]
# Bài 1: Hiệu ứng Nhà kính và Biến đổi Khí hậu

==================================================
QUY TẮC TẠO LINK TIMESTAMP YOUTUBE (BẮT BUỘC KHI CÓ VIDEO ID)
==================================================
Khi ngữ cảnh cung cấp **Video ID** và **PHỤ ĐỀ CÓ TIMESTAMP**, bạn PHẢI tạo link trực tiếp đến vị trí phút trên YouTube cho các khái niệm/ví dụ quan trọng được nhắc đến trong video.

CÚ PHÁP LINK: `[Mô tả ngắn](https://youtu.be/VIDEO_ID?t=GIÂY)`

VÍ DỤ:
- Video ID: `dQw4w9WgXcQ`, transcript có đoạn tại 02:30 (150 giây) nói về "biến số môi trường"
- Trong bài học, khi nhắc đến khái niệm này, viết: `biến số môi trường ([xem tại 02:30](https://youtu.be/dQw4w9WgXcQ?t=150))`

QUY TẮC:
1. CHỈ tạo link khi có Video ID trong ngữ cảnh
2. Tra cứu timestamp từ **PHỤ ĐỀ CÓ TIMESTAMP** được cung cấp (format: `[{"start": 150, "text": "..."}, ...]`)
3. Tìm đoạn transcript phù hợp nhất với nội dung bạn đang viết
4. Format: `[từ khóa](https://youtu.be/VIDEO_ID?t=GIÂY)` - GIÂY là số nguyên (start time)
5. Mô tả link ngắn gọn: "xem tại MM:SS" hoặc "xem video"
6. KHÔNG bịa đặt timestamp - CHỈ dùng thời gian thực từ transcript

⚠️ QUAN TRỌNG - QUY TẮC IN ĐẬM (BOLD) CHO TIMESTAMP LINKS:
==================================================
ĐỂ HỆ THỐNG TỰ ĐỘNG GẮN TIMESTAMP LINK, BẠN PHẢI VIẾT **IN ĐẬM** (BOLD) CÁC TỪ KHÓA CỤ THỂ TỪ NỘI DUNG VIDEO.

✅ ĐÚNG - In đậm KHÁI NIỆM CỤ THỂ TỪ VIDEO:
   - **ANSI Lumens**, **Keystone correction**, **Screen Door Effect**, **Pixel Shift**, **Fresnel Effect**, **Color Node**, **Multiply Node**, **PBR Master Node**

❌ KHÔNG ĐÚNG - ĐỪNG IN ĐẬM CÁC TIÊU ĐỀ CHUNG CHUNG:
   - **Câu hỏi cốt lõi:**, **Kết quả học tập:**, **Điều kiện tiên quyết:**, **Định nghĩa & Bản chất:**, **Nguyên lý/Cơ chế:**
   - **Tổng quan & Mục tiêu**, **Kiến thức nền tảng**, **Quy trình & Framework**, **Ví dụ thực tế**, **Sai lầm & Best Practices", "Bài tập thực hành"
   - **Bản chất khái niệm:**, **Bối cảnh ra đời:**, **So sánh & Vị trí:**, **Cấu trúc:**, **Bảng phân tích:**, **Giải thích sâu:**

QUY TẮC:
- CHỈ in đậm (bold) các KHÁI NIỆM CỤ THỂ, THUẬT NGỮ CHUYÊN NGÀNH, TÊN CÔNG NGHỆ, TÊN NODE, TÊN CÔNG CỤ, THAM SỐ KỸ THUẬT được nhắc trong video
- KHÔNG BAO GIỜ in đậm các từ khóa chung chung, tiêu đề mục, nhãn phân loại
- Mỗi từ khóa in đậm nên là 1-4 từ, là danh từ cụ thể (ví dụ: "ANSI Lumens" chứ không phải "Độ sáng")
- Hệ thống sẽ tự tìm timestamp trong transcript và gán link: `**ANSI Lumens**` → `**ANSI Lumens** ([xem tại 04:30](https://youtu.be/VIDEO_ID?t=270))`

==================================================

==================================================
CẤU TRÚC BÀI HỌC BẮT BUỘC (Độ dài: 1.500 - 3.000 từ)
==================================================

[MINDMAP_NODE: id="root" | label="[Tên Bài Học]" | parent_id="" | type="main"]
# [Tên Bài Học]

---

## 1. 🎯 Bức tranh toàn cảnh & Bản chất vấn đề
[MINDMAP_NODE: id="sec_1" | label="Toàn cảnh & Bản chất" | parent_id="root" | type="main"]

- Bản chất khái niệm: Định nghĩa chính xác, chuẩn xác theo góc nhìn chuyên gia. Khái niệm này thực chất là gì?
- Bối cảnh ra đời & Vấn đề thực tế: Vấn đề/nỗi đau/thách thức thực tế nào trong xã hội, tự nhiên hoặc hệ thống đã làm phát sinh khái niệm/công cụ/định lý này? Nếu không có nó, điều gì tiêu cực sẽ xảy ra?
[MINDMAP_NODE: id="sec_1_problem" | label="Vấn đề thực tế giải quyết" | parent_id="sec_1" | type="sub"]
- So sánh & Vị trí trong hệ thống: So sánh ngắn gọn với các giải pháp, lý thuyết hoặc công cụ tương tự/tiền nhiệm. Nêu rõ vị trí của nó trong bức tranh tổng thể của ngành/lĩnh vực.

---

## 2. 📖 Cấu trúc cốt lõi & Khai phá chi tiết các Khái niệm con
[MINDMAP_NODE: id="sec_2" | label="Cấu trúc & Cơ chế cốt lõi" | parent_id="root" | type="main"]

- Cấu trúc / Công thức / Mô hình gốc (Core Framework / Formula / Syntax): Trình bày dạng khung/khối/sơ đồ chữ rõ ràng đại diện cho cơ chế hoạt động của chủ đề.
- Bảng phân tích chi tiết các Thành phần / Tham số / Yếu tố cấu thành:
  | Tên Thành phần / Yếu tố | Kiểu / Bản chất | Giá trị mặc định / Trạng thái gốc | Ý nghĩa & Cách vận hành chi tiết trong thực tế |
  | --- | --- | --- | --- |
- Giải thích sâu từng khái niệm con:
  [MINDMAP_NODE: id="sec_2_subconcepts" | label="Các khái niệm con cốt lõi" | parent_id="sec_2" | type="sub"]
  Đào sâu từng khía cạnh, nguyên lý vận hành, quy luật tác động qua lại. Không bỏ sót bất kỳ chi tiết quan trọng nào.

==================================================
CẤU TRÚC BÀI HỌC BẮT BUỘC (Độ dài: 1.500 - 3.000 từ)
==================================================

[MINDMAP_NODE: id="root" | label="[Tên Bài Học]" | parent_id="" | type="main"]
# [Tên Bài Học]

---

## 1. 🎯 Bức tranh toàn cảnh & Bản chất vấn đề
[MINDMAP_NODE: id="sec_1" | label="Toàn cảnh & Bản chất" | parent_id="root" | type="main"]

- Bản chất khái niệm: Định nghĩa chính xác, chuẩn xác theo góc nhìn chuyên gia. Khái niệm này thực chất là gì?
- Bối cảnh ra đời & Vấn đề thực tế: Vấn đề/nỗi đau/thách thức thực tế nào trong xã hội, tự nhiên hoặc hệ thống đã làm phát sinh khái niệm/công cụ/định lý này? Nếu không có nó, điều gì tiêu cực sẽ xảy ra?
[MINDMAP_NODE: id="sec_1_problem" | label="Vấn đề thực tế giải quyết" | parent_id="sec_1" | type="sub"]
- So sánh & Vị trí trong hệ thống: So sánh ngắn gọn với các giải pháp, lý thuyết hoặc công cụ tương tự/tiền nhiệm. Nêu rõ vị trí của nó trong bức tranh tổng thể của ngành/lĩnh vực.

---

## 2. 📖 Cấu trúc cốt lõi & Khai phá chi tiết các Khái niệm con
[MINDMAP_NODE: id="sec_2" | label="Cấu trúc & Cơ chế cốt lõi" | parent_id="root" | type="main"]

- Cấu trúc / Công thức / Mô hình gốc (Core Framework / Formula / Syntax): Trình bày dạng khung/khối/sơ đồ chữ rõ ràng đại diện cho cơ chế hoạt động của chủ đề.
- Bảng phân tích chi tiết các Thành phần / Tham số / Yếu tố cấu thành:
  | Tên Thành phần / Yếu tố | Kiểu / Bản chất | Giá trị mặc định / Trạng thái gốc | Ý nghĩa & Cách vận hành chi tiết trong thực tế |
  | --- | --- | --- | --- |
- Giải thích sâu từng khái niệm con:
  [MINDMAP_NODE: id="sec_2_subconcepts" | label="Các khái niệm con cốt lõi" | parent_id="sec_2" | type="sub"]
  Đào sâu từng khía cạnh, nguyên lý vận hành, quy luật tác động qua lại. Không bỏ sót bất kỳ chi tiết quan trọng nào.

---

## 3. 🛠️ Hệ thống Quy tắc / Phương thức / Biến thể & Thuộc tính liên quan
[MINDMAP_NODE: id="sec_3" | label="Quy tắc & Biến thể liên quan" | parent_id="root" | type="main"]

Liệt kê đầy đủ các quy tắc, trường hợp đặc biệt, phương thức áp dụng hoặc các nhánh biến thể phổ biến nhất của chủ đề:
- `Khái niệm / Hàm / Quy tắc A`: [MINDMAP_NODE: id="rule_a" | label="Quy tắc A" | parent_id="sec_3" | type="sub"] Phân tích chi tiết nguyên lý + Ví dụ minh họa ngắn gọn.
- `Khái niệm / Hàm / Quy tắc B`: [MINDMAP_NODE: id="rule_b" | label="Quy tắc B" | parent_id="sec_3" | type="sub"] Phân tích chi tiết nguyên lý + Ví dụ minh họa ngắn gọn.
- `Khái niệm / Hàm / Quy tắc C`: [MINDMAP_NODE: id="rule_c" | label="Quy tắc C" | parent_id="sec_3" | type="sub"] Phân tích chi tiết nguyên lý + Ví dụ minh họa ngắn gọn.

---

## 4. 💻 / 🌍 Tình huống minh họa thực tế (Full Comprehensive Case Study / Example)
[MINDMAP_NODE: id="sec_4" | label="Tình huống thực tế" | parent_id="root" | type="main"]

- Bối cảnh Bài toán thực tế: Đưa ra một kịch bản hoàn chỉnh (Nếu là IT/Sự kiện logic: viết Code/Workflow; Nếu là Kinh tế/Chính trị/Môi trường/Xã hội: viết Kịch bản Case Study thực tế chi tiết).
- Kết quả diễn tiến / Đầu ra (Expected Outcome / Output): Mô tả chi tiết kết quả trả về, diễn biến sự kiện hoặc trạng thái đạt được.
- Phân tích chi tiết từng bước (Step-by-step Analysis): 
  [MINDMAP_NODE: id="sec_4_steps" | label="Các bước phân tích Case Study" | parent_id="sec_4" | type="sub"]
  Đánh số 1, 2, 3... giải thích rõ ràng tại sao từng bước/dòng/hành động lại diễn ra như vậy và nó kích hoạt hệ quả gì.

---

## 5. ⚠️ Lỗi thường gặp, Tư duy sai lệch & Quy chuẩn tối ưu (Best Practices & Pitfalls)
[MINDMAP_NODE: id="sec_5" | label="Lỗi phổ biến & Best Practices" | parent_id="root" | type="main"]

- 3 - 5 Sai lầm / Lỗi phổ biến nhất: (Đặc biệt là những hiểu lầm của người mới học hoặc tư duy lối mòn) Kèm theo nguyên nhân và cách khắc phục/điều chỉnh.
  [MINDMAP_NODE: id="sec_5_pitfalls" | label="Sai lầm thường gặp" | parent_id="sec_5" | type="sub"]
- Quy chuẩn chuyên nghiệp (Best Practices): Lưu ý về tối ưu hóa nguồn lực, hiệu năng, tính bền vững hoặc quy chuẩn đạo đức/thực thi khi áp dụng vào dự án/cuộc sống thực tế.

---

## 6. 🧪 Bài tập tư duy & Luyện tập ứng dụng (Thực hành mở)
[MINDMAP_NODE: id="sec_6" | label="Bài tập thực hành mở" | parent_id="root" | type="main"]

- Bài tập 1 (Cơ bản - Nhận biết & Phân tích): 
  - *Yêu cầu:* Câu hỏi kiểm tra mức độ hiểu sâu kiến thức hoặc bài tập giải quyết tình huống đơn giản.
  - *Hướng dẫn giải / Đáp án gợi ý:* Cung cấp dàn ý chi tiết hoặc logic đáp án chuẩn.
- Bài tập 2 (Nâng cao - Tư duy phản biện & Mở rộng/Case Study mở): 
  [MINDMAP_NODE: id="sec_6_adv" | label="Bài tập mở nâng cao" | parent_id="sec_6" | type="sub"]
  - *Yêu cầu mở:* Đưa ra một tình huống tiến thối lưỡng nan, một giả định phản thực tế (What-if scenario), hoặc một bài toán thiết kế hệ thống/chính sách mở. Yêu cầu người học tự đưa ra quan điểm và lập luận.
  - *Gợi ý góc nhìn / Khung phân tích (Framework) & Lời giải mẫu:* Đưa ra các tiêu chí đánh giá, các góc nhìn đa chiều (Kinh tế, Đạo đức, Kỹ thuật, Xã hội,...) và một bài giải mẫu hoàn chỉnh để người học tham khảo.

⚠️ QUAN TRỌNG: KHI VIẾT NỘI DUNG BÀI GIẢNG
==================================================
1. BẮT BUỘC: Mọi ý chính, ví dụ, giải thích PHẢI xuất phát từ PHỤ ĐỀ (TRANSCRIPT) được cung cấp trong ngữ cảnh
2. KHÔNG ĐƯỢC tự bịa đặt nội dung không có trong transcript
3. HÃY TRÍCH XUẤT các khái niệm, thuật ngữ, ví dụ TRỰC TIẾP từ transcript
4. Sử dụng transcript để xác định: tiêu đề bài học, các mục chính, ví dụ, giải thích
5. Nếu transcript không nhắc đến một chủ đề → KHÔNG viết về chủ đề đó
6. Video ID: {video_id} (sử dụng để tạo timestamp links)
7. Transcript có sẵn trong ngữ cảnh với format: [{{"start": giây, "text": "nội dung", "duration": giây}}, ...]

KHI VIẾT: Sau khi viết xong mỗi đoạn, ĐẶT ANCHOR NGAY TRƯỚC ĐOẠN ĐÓ với label = từ khóa CỤ THỂ từ transcript.
KHÔNG BAO GIỜ dùng label chung chung như "Định nghĩa", "Nguyên lý", "Các bước".
"""


async def _generate_content_with_retry(
    prompt: str,
    config,
    retries: int = 8,
    base_delay: float = 10.0,
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
                print(f"⚠️ [Gemini 503] Thử lại lần {attempt + 1}/{retries} sau {base_delay:.0f}s...")
                await asyncio.sleep(base_delay)
                base_delay *= 1.5
            else:
                raise
    raise last_exc


# System instruction to ensure AI follows anchor format strictly
LESSON_GENERATION_SYSTEM_INSTRUCTION = """
Bạn là Chuyên gia Giáo dục & Biên tập viên Tài liệu Chuyên sâu (phong cách MDN, Stanford Encyclopedia, Britannica, HBR).
Nhiệm vụ: Soạn thảo bài giảng SIÊU CHI TIẾT, ĐẦY ĐỦ, CHUYÊN SÂU, DỄ HIỂU.

⚠️ BẮT BUỘC: Chèn thẻ mỏ neo MINDMAP_NODE vào đúng vị trí theo CÚ PHÁP CHUẨN:
[MINDMAP_NODE: id="..." | label="..." | parent_id="..." | type="main|sub|detail"]

QUY TẮC ANCHOR - TUÂN THỦ NGHIÊM NGẨT:
==================================================
1. label = TỪ KHÓA CỤ THỂ TỪ NỘI DUNG BẠN VỪA VIẾT (2-4 từ tối đa)
   ✅ TỐT: "Variables & Data Types", "If/Else & Loops", "List Comprehension", "Decorator Pattern", "DCF Valuation", "SWOT Analysis"
   ❌ KHÔNG: "Định nghĩa then chốt", "Nguyên lý cơ bản", "Các bước thực hiện", "Framework tham khảo", "Tổng quan & Mục tiêu", "Kiến thức nền tảng"

2. MỖI ANCHOR ĐẶT NGAY TRƯỚC nội dung nó đại diện (heading, bullet point, đoạn văn).
   - Anchor chính (type="main"): NGAY TRƯỚC heading ## 1, ## 2, ...
   - Anchor phụ (type="sub"): NGAY TRƯỚC bullet point quan trọng nhất trong mục đó.

3. CHỈ 1 anchor chính mỗi mục lớn (sec_1..sec_7), CHỈ 1-2 anchor phụ cho khái niệm QUAN TRỌNG NHẤT.
   Tổng ~7-10 anchor mỗi bài học.

4. parent_id: "root" cho sec_1..sec_7, hoặc ID anchor cha (sec_1, sec_2, ...).

5. id giữ nguyên mẫu: root, sec_1, sec_1_objectives, sec_2, sec_2_definitions, sec_3, sec_3_steps, sec_4, sec_4_context, sec_5, sec_5_pitfalls, sec_6, sec_6_basic, sec_7.

⚠️ QUY TẮC IN ĐẬM (BOLD) CHO YOUTUBE TIMESTAMP LINKS:
==================================================
ĐỂ HỆ THỐNG TỰ ĐỘNG GẮN TIMESTAMP LINK, BẠN PHẢI VIẾT **IN ĐẬM** (BOLD) CÁC TỪ KHÓA CỤ THỂ TỪ NỘI DUNG VIDEO.

✅ ĐÚNG - In đậm KHÁI NIỆM CỤ THỂ TỪ VIDEO:
   - **ANSI Lumens**, **Keystone correction**, **Screen Door Effect**, **Pixel Shift**, **Fresnel Effect**, **Color Node**, **Multiply Node**, **PBR Master Node**

❌ KHÔNG ĐÚNG - ĐỪNG IN ĐẬM CÁC TIÊU ĐỀ CHUNG CHUNG:
   - **Câu hỏi cốt lõi:**, **Kết quả học tập:**, **Điều kiện tiên quyết:**, **Định nghĩa & Bản chất:**, **Nguyên lý/Cơ chế:**
   - **Tổng quan & Mục tiêu**, **Kiến thức nền tảng**, **Quy trình & Framework**, **Ví dụ thực tế**, **Sai lầm & Best Practices", "Bài tập thực hành"
   - **Bản chất khái niệm:**, **Bối cảnh ra đời:**, **So sánh & Vị trí:**, **Cấu trúc:**, **Bảng phân tích:**, **Giải thích sâu:**

QUY TẮC:
- CHỈ in đậm (bold) các KHÁI NIỆM CỤ THỂ, THUẬT NGỮ CHUYÊN NGÀNH, TÊN CÔNG NGHỆ, TÊN NODE, TÊN CÔNG CỤ, THAM SỐ KỸ THUẬT được nhắc trong video
- KHÔNG BAO GIỜ in đậm các từ khóa chung chung, tiêu đề mục, nhãn phân loại
- Mỗi từ khóa in đậm nên là 1-4 từ, là danh từ cụ thể (ví dụ: "ANSI Lumens" chứ không phải "Độ sáng")
- Hệ thống sẽ tự tìm timestamp trong transcript và gán link: `**ANSI Lumens**` → `**ANSI Lumens** ([xem tại 04:30](https://youtu.be/VIDEO_ID?t=270))`

VÍ DỤ MINH HỌA (Python lesson):
==================================================
[MINDMAP_NODE: id="root" | label="Python Variables & Control Flow" | parent_id="root" | type="main"]
# Bài 1: Python Variables & Control Flow

## 1. Tổng quan & Mục tiêu
[MINDMAP_NODE: id="sec_1" | label="Variables & Control Flow Basics" | parent_id="root" | type="main"]
- Câu hỏi cốt lõi: Làm sao lưu trữ dữ liệu và điều khiển luồng chương trình?
[MINDMAP_NODE: id="sec_1_objectives" | label="Variables, If/Else, Loops" | parent_id="sec_1" | type="sub"]

## 2. Kiến thức nền tảng
[MINDMAP_NODE: id="sec_2" | label="Variables, Types, Control Flow" | parent_id="root" | type="main"]
- Định nghĩa: **variable** (biến) là tên gán cho giá trị trong bộ nhớ...
[MINDMAP_NODE: id="sec_2_definitions" | label="Variables & Data Types" | parent_id="sec_2" | type="sub"]
- Control flow: **if/elif/else** điều khiển nhánh...
[MINDMAP_NODE: id="sec_2_control" | label="If/Else & Loops" | parent_id="sec_2" | type="sub"]

## 3. Quy trình & Framework
[MINDMAP_NODE: id="sec_3" | label="Input → Process → Output Pattern" | parent_id="root" | type="main"]
- Quy trình: Nhận input → Xử lý logic → Trả về output...
[MINDMAP_NODE: id="sec_3_steps" | label="Input-Process-Output" | parent_id="sec_3" | type="sub"]

## 4. Ví dụ thực tế
[MINDMAP_NODE: id="sec_4" | label="Calculator Program Example" | parent_id="root" | type="main"]
- Case study: Viết máy tính đơn giản...
[MINDMAP_NODE: id="sec_4_context" | label="Simple Calculator" | parent_id="sec_4" | type="sub"]

## 5. Sai lầm & Best Practices
[MINDMAP_NODE: id="sec_5" | label="Type Errors & Indentation" | parent_id="root" | type="main"]
- Sai lầm: Quên indent, nhầm type...
[MINDMAP_NODE: id="sec_5_pitfalls" | label="Indentation & Type Errors" | parent_id="sec_5" | type="sub"]

## 6. Bài tập
[MINDMAP_NODE: id="sec_6" | label="Temperature Converter Exercise" | parent_id="root" | type="main"]
- Bài tập: Viết chương trình chuyển °C ↔ °F...
[MINDMAP_NODE: id="sec_6_basic" | label="Temp Converter" | parent_id="sec_6" | type="sub"]

==================================================

==================================================

VÍ DỤ MINH HỌA (Python lesson):
==================================================
[MINDMAP_NODE: id="root" | label="Python Variables & Control Flow" | parent_id="root" | type="main"]
# Bài 1: Python Variables & Control Flow

## 1. Tổng quan & Mục tiêu
[MINDMAP_NODE: id="sec_1" | label="Variables & Control Flow Basics" | parent_id="root" | type="main"]
- Câu hỏi cốt lõi: Làm sao lưu trữ dữ liệu và điều khiển luồng chương trình?
[MINDMAP_NODE: id="sec_1_objectives" | label="Variables, If/Else, Loops" | parent_id="sec_1" | type="sub"]

## 2. Kiến thức nền tảng
[MINDMAP_NODE: id="sec_2" | label="Variables, Types, Control Flow" | parent_id="root" | type="main"]
- Định nghĩa: **variable** (biến) là tên gán cho giá trị trong bộ nhớ...
[MINDMAP_NODE: id="sec_2_definitions" | label="Variables & Data Types" | parent_id="sec_2" | type="sub"]
- Control flow: **if/elif/else** điều khiển nhánh...
[MINDMAP_NODE: id="sec_2_control" | label="If/Else & Loops" | parent_id="sec_2" | type="sub"]

## 3. Quy trình & Framework
[MINDMAP_NODE: id="sec_3" | label="Input → Process → Output Pattern" | parent_id="root" | type="main"]
- Quy trình: Nhận input → Xử lý logic → Trả về output...
[MINDMAP_NODE: id="sec_3_steps" | label="Input-Process-Output" | parent_id="sec_3" | type="sub"]

## 4. Ví dụ thực tế
[MINDMAP_NODE: id="sec_4" | label="Calculator Program Example" | parent_id="root" | type="main"]
- Case study: Viết máy tính đơn giản...
[MINDMAP_NODE: id="sec_4_context" | label="Simple Calculator" | parent_id="sec_4" | type="sub"]

## 5. Sai lầm & Best Practices
[MINDMAP_NODE: id="sec_5" | label="Type Errors & Indentation" | parent_id="root" | type="main"]
- Sai lầm: Quên indent, nhầm type...
[MINDMAP_NODE: id="sec_5_pitfalls" | label="Indentation & Type Errors" | parent_id="sec_5" | type="sub"]

## 6. Bài tập
[MINDMAP_NODE: id="sec_6" | label="Temperature Converter Exercise" | parent_id="root" | type="main"]
- Bài tập: Viết chương trình chuyển °C ↔ °F...
[MINDMAP_NODE: id="sec_6_basic" | label="Temp Converter" | parent_id="sec_6" | type="sub"]

==================================================

⚠️ QUAN TRỌNG NHẤT - BẮT BUỘC TUÂN THỦ:
==================================================
1. NỘI DUNG PHẢI DỰA TRÊN PHỤ ĐỀ (TRANSCRIPT) - KHÔNG ĐƯỢC TỰ BIẠT ĐẶT
2. MỖI Ý CHÍNH, VÍ DỤ, GIẢI THÍCH PHẢI XUẤT PHÁT TỪ PHỤ ĐỀ
3. KHÔNG ĐƯỢC TỰ BIẠT ĐẶT NỘI DUNG KHÔNG CÓ TRONG VIDEO
4. NẾU PHỤ ĐỀ KHÔNG NHẮC ĐẾN CHỦ ĐỀ NÀO → KHÔNG VIẾT VỀ CHỦ ĐỀ ĐÓ
5. VIDEO ID: Sử dụng để tạo timestamp links
6. PHỤ ĐỀ CÓ SẴN TRONG NGỮ CẢNH - HÃY DÙNG CHÚNG

KHI VIẾT: Sau khi viết xong mỗi đoạn, ĐẶT ANCHOR NGAY TRƯỚC ĐOẠN ĐÓ với label = từ khóa CỤ THỂ từ transcript.
KHÔNG BAO GIỜ dùng label chung chung như "Định nghĩa", "Nguyên lý", "Các bước".
"""


def inject_youtube_timestamp_links(content: str, video_id: str, transcript: list[dict]) -> str:
    """Post-process generated markdown to inject accurate YouTube timestamp links.
    
    Matches key phrases in content with transcript segments and adds 
    [text](https://youtu.be/VIDEO_ID?t=SECONDS) links.
    """
    if not video_id or not transcript:
        return content
    
    # Build searchable transcript segments
    segments = []
    for item in transcript:
        start = int(item.get('start', 0))
        text = item.get('text', '').strip()
        if text and len(text) > 10:
            segments.append({
                'start': start,
                'text': text.lower(),
                'original': item.get('text', '').strip()
            })
    
    if not segments:
        return content
    
    # Common key phrases that would benefit from timestamp links
    # We'll search for these patterns in the generated content
    import re
    
    def find_best_timestamp(query: str) -> int | None:
        """Find the best matching timestamp for a query."""
        query_lower = query.lower()
        best_match = None
        best_score = 0
        
        for seg in segments:
            # Simple word overlap scoring
            query_words = set(query_lower.split())
            seg_words = set(seg['text'].split())
            overlap = len(query_words & seg_words)
            if overlap > best_score and overlap >= 2:
                best_score = overlap
                best_match = seg['start']
        
        return best_match
    
    # Patterns to find and enhance with timestamp links
    # Match bold terms, technical terms, or quoted phrases that might be in transcript
    patterns = [
        # Bold terms: **term**
        (r'\*\*([^*]{3,50})\*\*', lambda m: f"**{m.group(1)}**"),
        # Quoted terms: "term" or 'term'
        (r'"([^"]{3,50})"', lambda m: f'"{m.group(1)}"'),
        (r"'([^']{3,50})'", lambda m: f"'{m.group(1)}'"),
    ]
    
    result = content
    
    # For each bold term, try to find a timestamp and add link
    # We'll process bold terms as they're likely key concepts
    bold_pattern = re.compile(r'\*\*([^*]{3,50})\*\*')
    
    def replace_bold(match):
        term = match.group(1)
        # Skip if already has a YouTube link
        if 'youtu.be' in match.group(0):
            return match.group(0)
        
        timestamp = find_best_timestamp(term)
        if timestamp is not None:
            mins = timestamp // 60
            secs = timestamp % 60
            return f"**{term}** ([xem tại {mins:02d}:{secs:02d}](https://youtu.be/{video_id}?t={timestamp}))"
        return match.group(0)
    
    result = bold_pattern.sub(replace_bold, result)
    
    return result


async def generate_single_lesson(topic: str, lesson: dict, tavily_context: str, idx: int, total: int, semaphore) -> dict:
    """Sinh chi tiết từng bài học trực tiếp qua Google GenAI SDK (Async) — Domain-aware"""
    async with semaphore:
        lesson_title = lesson["title"]
        lesson_summary = lesson["summary"]
        
        print(f"    [+ Processing] ({idx}/{total}) Đang soạn bài với Gemini Flash: '{lesson_title}'...")

        # Auto-detect domain from topic + context
        domain = detect_domain(topic, tavily_context)
        print(f"    [Domain] Detected: {domain}")

        detail_prompt = build_lesson_prompt(
            topic=topic,
            lesson_title=lesson_title,
            lesson_summary=lesson_summary,
            tavily_context=tavily_context,
            domain=None,  # Auto-detect inside
        )

# Separate system instruction from user content to prevent prompt injection
        # System instruction is the detailed prompt template
        # User content is the specific lesson info + tavily context
        
        system_instruction = LESSON_GENERATION_SYSTEM_INSTRUCTION
        
        # Build user content (topic, lesson_title, lesson_summary, tavily_context)
        user_content = f"""THÔNG TIN BÀI HỌC CẦN VIẾT:
- Chủ đề tổng thể: {topic}
- Tên bài học: {lesson_title}
- Mục tiêu tóm tắt: {lesson_summary}

NGỮ CẢNH THAM KHẢO (Tavily):
{tavily_context}

---
HÃY SOẠN THẢO BÀI HỌC THEO ĐÚNG CẤU TRÚC VÀ PHONG CÁCH TRÊN.
NHỚ: PHẢI THAY THẾ TẤT CẢ label="**AI: ...**" BẰNG TỪ KHÓA CỤ THỂ TỪ NỘI DUNG BẠN VIẾT!"""

        try:
                async with asyncio.timeout(180.0):
                    response = await _generate_content_with_retry(
                        user_content,
                        types.GenerateContentConfig(
                            temperature=0.4,
                            system_instruction=system_instruction,
                        ),
                    )
                
                text_content = response.text or ""

                if not text_content.strip():
                    raise ValueError("Google GenAI API trả về nội dung rỗng (Empty content)")

        except Exception as e:
            print(f"❌ [LỖI Gemini Flash bài '{lesson_title}']: {e}")
            traceback.print_exc()
            text_content = f"# {lesson_title}\n\n*Nội dung bài học này đang được bổ sung.*"

        # Extract video_id and transcript from tavily_context for post-processing
        video_id = None
        transcript = []
        if "Video ID:" in tavily_context:
            for line in tavily_context.split('\n'):
                if line.startswith("Video ID:"):
                    video_id = line.replace("Video ID:", "").strip()
                if line.startswith("PHỤ ĐỀ CÓ TIMESTAMP"):
                    # Find JSON after this marker
                    marker = "PHỤ ĐỀ CÓ TIMESTAMP (dùng để tạo link):"
                    marker_idx = tavily_context.find(marker)
                    if marker_idx >= 0:
                        json_start = tavily_context.find('[', marker_idx)
                        json_end = tavily_context.find(']', json_start) + 1
                        if json_start >= 0 and json_end > json_start:
                            try:
                                transcript = json.loads(tavily_context[json_start:json_end])
                            except:
                                pass
        
        # Post-process: inject accurate YouTube timestamp links
        if video_id and transcript:
            text_content = inject_youtube_timestamp_links(text_content, video_id, transcript)
        
        return {
            "title": lesson_title,
            "summary": lesson.get("summary", ""),
            "text_content": text_content
        }


async def parse_context_to_structure(
    topic: str,
    tavily_context: str,
    folder_name: str,
    on_event: callable = None,
    video_id: str = None,
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

    # Use system_instruction to separate system prompt from user content (prevents prompt injection)
    outline_system_prompt = """Bạn là Kiến trúc sư Chương trình Giảng dạy (Curriculum Architect).
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
}"""

    # User content goes in the main prompt
    outline_user_prompt = f"Chủ đề: {topic}\n\nNgữ cảnh Tavily:\n{tavily_context}"

    outline_res = await _generate_content_with_retry(
        user_content, #outline_user_prompt,
        types.GenerateContentConfig(
            response_mime_type="application/json",  # Ép trả về JSON chuẩn
            temperature=0.3,
            system_instruction=system_instruction, #outline_system_prompt,
        ),
    )

    raw_json = outline_res.text or "{}"
    try:
        outline_data = json.loads(raw_json)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', raw_json, re.DOTALL)
        if json_match:
            try:
                outline_data = json.loads(json_match.group())
            except json.JSONDecodeError:
                outline_data = {}
        else:
            outline_data = {}

    lessons_list = outline_data.get("lessons", [])
    if not lessons_list:
        lessons_list = [
            {"title": f"Bài 1: Tổng quan về {topic}", "summary": f"Khái niệm và bức tranh toàn cảnh về {topic}"},
            {"title": f"Bài 2: Cấu trúc và nguyên lý cơ bản của {topic}", "summary": f"Chi tiết kiến thức nền tảng"},
            {"title": f"Bài 3: Ứng dụng và bài tập thực hành", "summary": f"Thực hành và vận dụng thực tế"},
        ]
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

    # Write debug output file for inspection
    import re
    vid = video_id if video_id else "unknown"
    # Sanitize folder_name for filename (remove invalid chars)
    safe_folder = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', folder_name)
    safe_folder = safe_folder[:100]  # Limit length
    debug_file = f"debug_youtube_{safe_folder}_{vid}.txt"
    with open(debug_file, 'w', encoding='utf-8') as f:
        f.write(f"FOLDER: {folder_name}\n")
        f.write(f"VIDEO ID: {vid}\n")
        f.write(f"TOPIC: {topic}\n")
        f.write(f"TOTAL LESSONS: {total_lessons}\n")
        f.write("="*80 + "\n\n")
        
        for i, file in enumerate(final_files, 1):
            content = file.get("text_content", "")
            f.write(f"\n\n{'='*80}\n")
            f.write(f"FILE {i}: {file.get('title')}\n")
            f.write(f"{'='*80}\n\n")
            f.write(content)
            
            # Check for timestamp links
            links = re.findall(r'\[xem tại \d{2}:\d{2}\].*?youtu\.be', content)
            bold_terms = re.findall(r'\*\*([^*]{3,50})\*\*', content)
            
            f.write(f"\n\n--- ANALYSIS ---\n")
            f.write(f"Timestamp links: {len(links)}\n")
            f.write(f"Bold terms: {bold_terms[:20]}\n")
            f.write(f"Timestamp links found: {links}\n")
    print(f"  [Debug] Full AI output saved to: {debug_file}")
    return {
        "folder_name": folder_name,
        "files": final_files,
    }