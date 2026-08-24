import re
import json
import asyncio
from yt_dlp import YoutubeDL
from youtube_transcript_api import YouTubeTranscriptApi
from google import genai
from google.genai import types
from app.core.config import settings

api_key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None)
client = genai.Client(api_key=api_key)
MODEL_NAME = "gemini-3.5-flash-lite"

class YouTubeTranscriptService:
    @staticmethod
    def extract_video_id(url: str) -> str:
        """Extracts 11-char video ID from YouTube URL."""
        match = re.search(r"(?:v=|\/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
        raise ValueError(f"Không thể tìm thấy Video ID hợp lệ từ URL: {url}")

    @classmethod
    def fetch_video_metadata(cls, youtube_url: str) -> str:
        """Fallback: Lấy Tiêu đề, Mô tả và Tags khi video không có Phụ đề."""
        ydl_opts = {'skip_download': True, 'quiet': True}
        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                title = info.get('title', '')
                description = info.get('description', '')
                tags = ", ".join(info.get('tags', []) or [])
                return f"Tiêu đề Video: {title}\n\nMô tả Video:\n{description}\n\nTừ khóa (Tags): {tags}"
        except Exception as e:
            raise RuntimeError(f"Video không có phụ đề và không thể lấy thông tin chi tiết: {str(e)}")

    @classmethod
    def fetch_transcript_text(cls, video_id: str, youtube_url: str) -> str:
        """Thử lấy phụ đề. Nếu video không có phụ đề, tự động fallback lấy Metadata."""
        try:
            # 1. Ưu tiên lấy phụ đề Tiếng Việt hoặc Tiếng Anh
            fetched = YouTubeTranscriptApi.get_transcript(video_id, languages=["vi", "en"])
            return " ".join([item["text"] for item in fetched])
        except Exception:
            try:
                # 2. Thử lấy bất kỳ phụ đề tự động (auto-generated) nào sẵn có
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                fetched = transcript_list.find_transcript(["vi", "en"]).fetch()
                return " ".join([item["text"] for item in fetched])
            except Exception:
                # 3. Fallback khi KHÔNG CÓ PHỤ ĐỀ: Lấy Metadata thông qua yt-dlp
                print(f"⚠️ Video {video_id} không có phụ đề. Chuyển sang lấy thông tin Metadata...")
                return cls.fetch_video_metadata(youtube_url)

    @classmethod
    async def get_roadmap_outline_from_transcript(cls, youtube_url: str) -> tuple[str, dict]:
        video_id = cls.extract_video_id(youtube_url)
        context_text = await asyncio.to_thread(cls.fetch_transcript_text, video_id, youtube_url)

        prompt = f"""
        Dưới đây là Dữ liệu Nội dung (Phụ đề hoặc Thông tin chi tiết) của một Video YouTube:

        ---
        {context_text[:30000]}
        ---

        Dựa trên nội dung ở trên, hãy thiết kế một Cây Lộ Trình Học Tập gồm 6-10 bài học.
        Trả về DUY NHẤT định dạng JSON theo mẫu:
        {{
          "folder_name": "Tên Folder Lộ Trình Theo Chủ Đề Video",
          "lessons": [
            {{"title": "Bài 1: [Tên bài học]", "summary": "Tóm tắt 1-2 câu"}},
            {{"title": "Bài 2: [Tên bài học]", "summary": "Tóm tắt 1-2 câu"}}
          ]
        }}
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
        outline_data = json.loads(raw_json)
        return context_text, outline_data