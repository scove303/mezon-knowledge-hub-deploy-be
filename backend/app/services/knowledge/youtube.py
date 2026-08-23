import re
import json
import asyncio
import urllib.request
from google import genai
from google.genai import types
from youtube_transcript_api import YouTubeTranscriptApi
from app.core.config import settings
from app.services.search.tavily import tavily_search

api_key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None)
client = genai.Client(api_key=api_key)
MODEL_NAME = "gemini-3.5-flash"


def extract_youtube_video_id(url: str) -> str | None:
    """Extract 11-char YouTube Video ID from various URL formats."""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11})',
        r'(?:embed\/|v\/|vi\/|youtu\.be\/|\/v\/|e\/|watch\?v=|&v=)([^#&?]*).*',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match and len(match.group(1)) == 11:
            return match.group(1)
    return None


def get_youtube_video_info(youtube_url: str) -> dict:
    """Get video title & author name via YouTube oEmbed API."""
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={youtube_url}&format=json"
        req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return {
                "title": data.get("title", ""),
                "author_name": data.get("author_name", "")
            }
    except Exception as e:
        print(f"[YouTube oEmbed error]: {e}")
    return {}


def get_youtube_transcript(video_id: str) -> str:
    """Fetch video transcript if subtitles are available."""
    try:
        ytt = YouTubeTranscriptApi()
        if hasattr(ytt, 'fetch'):
            data = ytt.fetch(video_id)
            # FetchedTranscriptSnippet is a dataclass with .text attribute (not a dict)
            return " ".join([getattr(item, 'text', '') for item in data])
    except Exception as e:
        print(f"[YouTube transcript unavailable for {video_id}]: {e}")
    return ""


class YouTubeNativeService:
    @classmethod
    async def extract_outline_from_youtube_url(cls, youtube_url: str) -> dict:
        video_id = extract_youtube_video_id(youtube_url)
        info = get_youtube_video_info(youtube_url)
        video_title = info.get("title", "")
        author_name = info.get("author_name", "")

        transcript = ""
        has_transcript = False
        if video_id:
            transcript = get_youtube_transcript(video_id)
            has_transcript = bool(transcript)

        # Nếu không lấy được transcript, fallback tìm kiếm nội dung trên web
        web_context = ""
        if not transcript and video_title:
            try:
                # Tìm kiếm cụ thể về nội dung/chủ đề video, không chỉ tên
                search_query = f"{video_title} {author_name} nội dung bài học tutorial"
                web_context = await tavily_search(search_query)
            except Exception as e:
                print(f"[Tavily fallback error]: {e}")

        # Xây dựng nội dung thực tế cung cấp cho Gemini
        content_block = []
        if video_title:
            content_block.append(f"TIÊU ĐỀ VIDEO YOUTUBE: {video_title}")
        if author_name:
            content_block.append(f"KÊNH XUẤT BẢN: {author_name}")
        if transcript:
            content_block.append(f"NỘI DUNG PHỤ ĐỀ (TRANSCRIPT):\n{transcript[:8000]}")
        elif web_context:
            content_block.append(f"THÔNG TIN CHỦ ĐỀ TÌM KIẾM TRÊN WEB:\n{web_context[:6000]}")
        else:
            content_block.append(f"ĐƯỜNG DẪN VIDEO: {youtube_url}")

        combined_input = "\n\n".join(content_block)

        prompt = f"""
Phân tích CHÍNH XÁC nội dung video YouTube dựa trên thông tin thực tế được cung cấp dưới đây 
và thiết kế một Cây Lộ Trình Học Tập (Educational Roadmap) chi tiết từ 8 đến 12 bài học.

⚠️ QUY TẮC BẮT BUỘC:
1. `folder_name`: Phải dựa trên Tiêu đề/Chủ đề THỰC TẾ của Video ({video_title or 'Chủ đề Video'}). 
   KHÔNG ĐƯỢC tự đặt tên là "Tóm tắt YouTube" hay "Tìm hiểu về YouTube"!
2. Mỗi bài học có tiêu đề rõ ràng, thực tế và tóm tắt 1-2 câu.

TRẢ VỀ JSON DUY NHẤT ĐÚNG ĐỊNH DẠNG:
{{
  "folder_name": "Tên Lộ Trình Học Tập Dựa Trên Nội Dung Video Thực Tế",
  "lessons": [
    {{"title": "Bài 1: [Tiêu đề bài học]", "summary": "Tóm tắt 1-2 câu..."}},
    {{"title": "Bài 2: [Tiêu đề bài học]", "summary": "Tóm tắt 1-2 câu..."}}
  ]
}}

NỘI DUNG VIDEO THỰC TẾ:
{combined_input}
"""

        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        raw_json = response.text or "{}"
        try:
            data = json.loads(raw_json)
            # Ensure folder_name is clean and uses real video title if Gemini generated generic name
            if data.get("folder_name", "").lower() in ["youtube summary", "tìm hiểu về youtube", "youtube", "tóm tắt youtube"]:
                if video_title:
                    data["folder_name"] = video_title
            data["has_transcript"] = has_transcript
            data["video_title"] = video_title
            return data
        except Exception:
            return {
                "folder_name": video_title or "Lộ trình từ Video YouTube",
                "has_transcript": has_transcript,
                "video_title": video_title,
                "lessons": [
                    {"title": f"Bài 1: {video_title or 'Tổng quan nội dung'}", "summary": "Nội dung phân tích từ video YouTube."}
                ]
            }