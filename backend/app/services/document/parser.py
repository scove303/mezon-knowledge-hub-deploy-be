import json
from google import genai
from google.genai import types
from app.core.config import settings
from schemas.folder import *

# Khởi tạo Client bằng API Key
client = genai.Client(api_key=settings.GEMINI_API_KEY)

async def parse_context_to_structure(topic: str, tavily_context: str) -> dict:
    """
    Nạp dữ liệu cào từ Tavily vào Gemini Flash để tự động thiết kế Cây Thư Mục & Bài Học
    """
    
    # 1. System Instruction: Định hướng vai trò và ép kiểu trả về
    system_instruction = """
    Bạn là một Chuyên gia Giáo dục và Tổng hợp Kiến thức Đa lĩnh vực (Universal Knowledge Synthesizer).
    Nhiệm vụ của bạn là đọc toàn bộ dữ liệu ngữ cảnh thu thập từ Internet (Tavily Context), sau đó cô đọng, hệ thống hóa và biên soạn thành một Lộ trình Học tập / Tài liệu Tổng hợp hoàn chỉnh cho BẤT KỲ LĨNH VỰC NÀO (Kinh tế, Ngôn ngữ, Khoa học, Nghệ thuật, Kỹ năng sống, Công nghệ,...).

    YÊU CẦU BÌNH GIẢNG & TỔNG HỢP:
    1. LỌC BỎ THÔNG TIN RÁC: Loại bỏ hoàn toàn các đoạn văn quảng cáo, lời chào hỏi, thông tin trùng lặp giữa các nguồn.
    2. CẤU TRÚC HÓA: Chia lộ trình thành các chủ đề/bài học theo trình tự logic (Tầm nhìn tổng quan -> Kiến thức cốt lõi -> Ứng dụng thực tế).
    3. SOẠN THẢO BÀI HỌC (text_content): 
    - Viết bằng Markdown sạch đẹp, sinh động.
    - Luôn bao gồm các phần: 📌 Tóm tắt cốt lõi, 💡 Mẹo/Lưu ý thực tế, và 📝 Bắt tay vào thực hành (hoặc Ví dụ minh họa phù hợp với lĩnh vực đó).

    Trả về BẮT BUỘC định dạng JSON chuẩn theo schema quy định.
    """

    # 2. Prompt chứa thông tin đầu vào
    prompt = f"""
    Chủ đề cần tạo lộ trình: {topic}
    
    Dữ liệu ngữ cảnh cào từ Internet (Tavily Context):
    {tavily_context}
    """

    # 3. Gọi Gemini 1.5 / 2.0 Flash với chế độ response_mime_type="application/json"
    response = await client.aio.models.generate_content(
        model="gemini-1.5-flash",  # Hoặc "gemini-2.0-flash"
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=RoadmapResponse,
            temperature=0.3, # Đặt thấp để AI bám sát dữ liệu thực tế, tránh bốc phét
        )
    )

    # 4. Parse chuỗi JSON trả về thành Python Dictionary
    try:
        data_structure = json.loads(response.text)
        return data_structure
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini trả về JSON không hợp lệ: {str(e)}")