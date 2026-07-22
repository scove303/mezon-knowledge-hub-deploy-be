import json
from google import genai
from google.genai import types
from app.core.config import settings

# Khởi tạo Client bằng SDK mới chuẩn chính thức của Google
client = genai.Client(api_key=settings.GEMINI_API_KEY)

async def parse_context_to_structure(topic: str, tavily_context: str) -> dict:
    """
    Nạp dữ liệu cào từ Tavily vào Gemini Flash để tự động thiết kế Cây Thư Mục & Bài Học
    """
    
    # 1. System Instruction định hướng vai trò và định dạng JSON
    system_instruction = """
    Bạn là một Chuyên gia Giáo dục và Tổng hợp Kiến thức Đa lĩnh vực (Universal Knowledge Synthesizer).
    Nhiệm vụ của bạn là đọc toàn bộ dữ liệu ngữ cảnh thu thập từ Internet (Tavily Context), sau đó cô đọng, hệ thống hóa và biên soạn thành một Lộ trình Học tập / Tài liệu Tổng hợp hoàn chỉnh cho BẤT KỲ LĨNH VỰC NÀO (Kinh tế, Ngôn ngữ, Khoa học, Nghệ thuật, Kỹ năng sống, Công nghệ,...).

    YÊU CẦU BÌNH GIẢNG & TỔNG HỢP:
    1. LỌC BỎ THÔNG TIN RÁC: Loại bỏ hoàn toàn các đoạn văn quảng cáo, lời chào hỏi, thông tin trùng lặp giữa các nguồn.
    2. CẤU TRÚC HÓA: Chia lộ trình thành các chủ đề/bài học theo trình tự logic (Tầm nhìn tổng quan -> Kiến thức cốt lõi -> Ứng dụng thực tế).
    3. SOẠN THẢO BÀI HỌC (text_content): 
    - Viết bằng Markdown sạch đẹp, sinh động.
    - Luôn bao gồm các phần: 📌 Tóm tắt cốt lõi, 💡 Mẹo/Lưu ý thực tế, và 📝 Bắt tay vào thực hành (hoặc Ví dụ minh họa phù hợp với lĩnh vực đó).

    BẮT BUỘC trả về dữ liệu chuẩn định dạng JSON theo đúng cấu trúc mẫu sau (Không kèm bất kỳ đoạn văn bản thừa nào):
    {
      "folder_name": "Tên lộ trình/thư mục bài học",
      "files": [
        {
          "title": "Tên bài học 1",
          "text_content": "# Nội dung bài học 1 bằng Markdown..."
        },
        {
          "title": "Tên bài học 2",
          "text_content": "# Nội dung bài học 2 bằng Markdown..."
        }
      ]
    }
    """

    # 2. Prompt chứa dữ liệu
    prompt = f"""
    Chủ đề cần tạo lộ trình: {topic}
    
    Dữ liệu ngữ cảnh cào từ Internet (Tavily Context):
    {tavily_context}
    """

    # 3. Gọi Gemini 2.0 Flash qua Client Async (`client.aio`)
    # Dùng model "gemini-2.0-flash" hoặc "gemini-1.5-flash"
    response = await client.aio.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            temperature=0.3,
        )
    )

    # 4. Parse JSON
    try:
        data_structure = json.loads(response.text)
        return data_structure
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini trả về JSON không hợp lệ: {str(e)}\nRaw Response: {response.text}")