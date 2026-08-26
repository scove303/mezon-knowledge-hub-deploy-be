import re
import json
import asyncio
import urllib.request
import aiohttp
from yt_dlp import YoutubeDL
from youtube_transcript_api import YouTubeTranscriptApi
from google import genai
from google.genai import types
from app.core.config import settings
from app.services.search.tavily import tavily_search

api_key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None)
client = genai.Client(api_key=api_key)
MODEL_NAME = "gemini-3.5-flash"

# TranscriptAPI.com configuration - loaded from settings (.env)
TRANSCRIPT_API_KEY = getattr(settings, "TRANSCRIPT_API_KEY", "")
TRANSCRIPT_API_BASE = getattr(settings, "TRANSCRIPT_API_BASE", "https://transcriptapi.com/api/v1")

# Supadata.ai configuration - loaded from settings (.env)
SUPADATA_API_KEY = getattr(settings, "SUPADATA_API_KEY", "")
SUPADATA_API_BASE = getattr(settings, "SUPADATA_API_BASE", "https://api.supadata.ai/v1")


def extract_video_id(url: str) -> str:
    """Extracts 11-char video ID from YouTube URL."""
    match = re.search(r"(?:v=|\/)([a-zA-Z0-9_-]{11})", url)
    if match:
        return match.group(1)
    raise ValueError(f"Không thể tìm thấy Video ID hợp lệ từ URL: {url}")


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


async def get_transcript_from_transcriptapi(video_id: str) -> list[dict]:
    """Fetch transcript from TranscriptAPI.com - more reliable than youtube_transcript_api."""
    try:
        url = f"{TRANSCRIPT_API_BASE}/transcript"
        headers = {
            "Authorization": f"Bearer {TRANSCRIPT_API_KEY}",
            "Content-Type": "application/json"
        }
        params = {"video_id": video_id, "format": "json"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    transcript = data.get("transcript", [])
                    return [
                        {
                            "start": float(item.get("start", 0)),
                            "duration": float(item.get("duration", 0)),
                            "text": item.get("text", "")
                        }
                        for item in transcript
                    ]
                else:
                    error_text = await resp.text()
                    print(f"[TranscriptAPI error {resp.status}]: {error_text}")
                    return []
    except Exception as e:
        print(f"[TranscriptAPI error for {video_id}]: {e}")
        return []


def get_youtube_transcript(video_id: str) -> list[dict]:
    """Fetch video transcript with timestamps - fallback to youtube_transcript_api."""
    try:
        ytt = YouTubeTranscriptApi()
        if hasattr(ytt, 'fetch'):
            data = ytt.fetch(video_id)
            return [
                {
                    "start": getattr(item, 'start', 0),
                    "duration": getattr(item, 'duration', 0),
                    "text": getattr(item, 'text', '')
                }
                for item in data
            ]
    except Exception as e:
        print(f"[YouTube transcript unavailable for {video_id}]: {e}")
    return []


async def get_transcript_from_supadata(video_id: str) -> list[dict]:
    """Fetch transcript from Supadata.ai REST API."""
    if not SUPADATA_API_KEY:
        print("[Supadata] No API key configured, skipping")
        return []
    
    url = f"{SUPADATA_API_BASE}/youtube/transcript"
    headers = {
        "x-api-key": SUPADATA_API_KEY,
        "Content-Type": "application/json"
    }
    params = {"id": video_id, "lang": "en"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Supadata returns: {"content": [{"text": "...", "start": 0.0, "duration": 5.0}, ...]}
                    content = data.get("content", [])
                    if content:
                        print(f"[Supadata] Got {len(content)} segments")
                        return [
                            {
                                "start": float(item.get("start", 0)),
                                "duration": float(item.get("duration", 0)),
                                "text": item.get("text", "")
                            }
                            for item in content
                        ]
                    return []
                elif resp.status == 401:
                    print("[Supadata] Invalid API key")
                    return []
                elif resp.status == 404:
                    print(f"[Supadata] No transcript available for video_id={video_id}")
                    return []
                else:
                    error_text = await resp.text()
                    print(f"[Supadata] Error {resp.status}: {error_text[:200]}")
                    return []
    except Exception as e:
        print(f"[Supadata] Error: {e}")
        return []


async def get_best_transcript(video_id: str) -> list[dict]:
    """Try Supadata.ai first (REST API, works on cloud IPs), then TranscriptAPI, fallback to youtube_transcript_api."""
    # 1. Try Supadata.ai first (REST API, works on cloud IPs)
    transcript = await get_transcript_from_supadata(video_id)
    if transcript:
        print(f"[Transcript] Got {len(transcript)} segments from Supadata.ai")
        return transcript
    
    # 2. Try TranscriptAPI.com (MCP - may not work as REST)
    transcript = await get_transcript_from_transcriptapi(video_id)
    if transcript:
        print(f"[Transcript] Got {len(transcript)} segments from TranscriptAPI.com")
        return transcript
    
    # 3. Fallback to youtube_transcript_api (IP blocked on cloud)
    transcript = get_youtube_transcript(video_id)
    if transcript:
        print(f"[Transcript] Got {len(transcript)} segments from youtube_transcript_api (fallback)")
    else:
        print(f"[Transcript] WARNING: No transcript available for video_id={video_id} (IP blocked or no captions)")
    return transcript


def format_transcript_for_context(transcript: list[dict], max_chars: int = 8000) -> str:
    """Format transcript with timestamps for AI context."""
    if not transcript:
        return ""
    lines = []
    for item in transcript:
        start_sec = int(item.get('start', 0))
        minutes = start_sec // 60
        seconds = start_sec % 60
        timestamp = f"[{minutes:02d}:{seconds:02d}]"
        lines.append(f"{timestamp} {item.get('text', '')}")
    result = "\n".join(lines)
    return result[:max_chars]


def format_transcript_for_linking(transcript: list[dict]) -> list[dict]:
    """Prepare transcript data for timestamp link injection."""
    return [
        {
            "start": int(item.get('start', 0)),
            "duration": int(item.get('duration', 0)),
            "text": item.get('text', '').strip()
        }
        for item in transcript
        if item.get('text', '').strip()
    ]


class YouTubeNativeService:
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
          "folder_name": "Tên Lộ Trình Học Tập Theo Chủ Đề Video",
          "lessons": [
            {{"title": "Bài 1: [Tên bài học]", "summary": "Tóm tắt 1-2 câu"}},
            {{"title": "Bài 2: [Tên bài học]", "summary": "Tóm tắt 1-2 câu"}}
          ]
        }}
        """

        # Wrap with retry for 503 errors
        async def generate_with_retry():
            retries = 8
            base_delay = 10.0
            last_exc = None
            for attempt in range(retries):
                try:
                    return await client.aio.models.generate_content(
                        model=MODEL_NAME,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.3,
                        ),
                    )
                except Exception as e:
                    last_exc = e
                    code = getattr(e, "code", None)
                    is_503 = code == 503 or "503" in str(e) or "UNAVAILABLE" in str(e)
                    if is_503:
                        print(f"⚠️ [Gemini 503 Outline] Thử lại lần {{attempt + 1}}/8 sau {{base_delay:.0f}}s...")
                        base_delay *= 1.5
                        await asyncio.sleep(base_delay)
                    else:
                        raise
            raise last_exc
        
        response = await generate_with_retry()

        raw_json = response.text or "{}"
        outline_data = json.loads(raw_json)
        return context_text, outline_data

    @staticmethod
    def extract_video_id(url: str) -> str:
        """Extracts 11-char video ID from YouTube URL."""
        match = re.search(r"(?:v=|\/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
        raise ValueError(f"Không thể tìm thấy Video ID hợp lệ từ URL: {url}")