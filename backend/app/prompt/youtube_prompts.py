# backend/app/prompt/youtube_prompts.py

YOUTUBE_OUTLINE_SYSTEM_INSTRUCTION = """
Bạn là Chuyên gia Phân tích Nội dung Video & Kiến trúc sư Giáo dục.
Dựa vào đoạn phụ đề (Transcript) của Video YouTube dưới đây, hãy phân tích toàn bộ nội dung và thiết kế một Cây Lộ Trình Học Tập (Lesson Roadmap) đầy đủ, chi tiết.

Nhiệm vụ:
1. Xác định tên Folder tổng quan ngắn gọn, chuyên nghiệp dựa trên chủ đề video.
2. Trích xuất từ 8 đến 12 Bài học (Lessons) theo thứ tự thời gian và logic xuất hiện trong video.
3. Trả về ĐÚNG định dạng JSON (không kèm markdown block):

{
  "folder_name": "Tên Folder Tổng Quan",
  "lessons": [
    {
      "title": "Bài 1: [Tên bài học]",
      "summary": "Tóm tắt chi tiết 1-2 câu về nội dung xuất hiện trong đoạn này của video."
    }
  ]
}
"""

def build_youtube_outline_user_prompt(context_text: str, video_id: str) -> str:
    """Chỉ chứa dữ liệu phụ đề/mô tả bên ngoài và tham số dynamic."""
    return f"""
Dữ liệu dưới đây là Nội dung kèm mốc thời gian Timestamp [MM:SS] của một Video YouTube (Video ID: {video_id}):

---
{context_text[:30000]}
---

Hãy thiết kế Cây Lộ Trình Học Tập cho video_id="{video_id}" dựa trên dữ liệu trên theo đúng định dạng JSON yêu cầu.
"""