import re
import json
import asyncio
import urllib.request
import aiohttp
from google import genai
from google.genai import types
from youtube_transcript_api import YouTubeTranscriptApi
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
                    # TranscriptAPI returns: {"transcript": [{"start": 0.0, "duration": 5.2, "text": "..."}, ...]}
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
        "Authorization": f"Bearer {SUPADATA_API_KEY}",
        "Content-Type": "application/json"
    }
    params = {"video_id": video_id, "lang": "en", "format": "json"}
    
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
    async def extract_outline_from_youtube_url(cls, youtube_url: str) -> dict:
        video_id = extract_youtube_video_id(youtube_url)
        print(f"[YouTube] Extracted video_id: '{video_id}' from URL: {youtube_url}")
        info = get_youtube_video_info(youtube_url)
        video_title = info.get("title", "")
        author_name = info.get("author_name", "")

        transcript = []
        has_transcript = False
        if video_id:
            transcript = await get_best_transcript(video_id)
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
            transcript_text = format_transcript_for_context(transcript)
            content_block.append(f"""NỘI DUNG PHỤ ĐỀ TỰ ĐỘNG (CÓ TIMESTAMP) - LƯU Ý: Có thể chứa lỗi nhận dạng giọng nói, đặc biệt ở đoạn mở đầu. HÃY ƯU TIÊN TIÊU ĐỀ VIDEO VÀ CÁC ĐOẠN CÓ NGỮ CẢNH SÚC TÍCH:
{transcript_text}""")
        elif web_context:
            content_block.append(f"THÔNG TIN CHỦ ĐỀ TÌM KIẾM TRÊN WEB:\n{web_context[:6000]}")
        else:
            content_block.append(f"ĐƯỜNG DẪN VIDEO: {youtube_url}")

        combined_input = "\n\n".join(content_block)

        prompt = f"""
Phân tích CHÍNH XÁC nội dung video YouTube dựa trên thông tin thực tế được cung cấp dưới đây 
và thiết kế một Cây Lộ Trình Học Tập (Educational Roadmap) chi tiết từ 8 đến 12 bài học.

⚠️ QUY TẮC BẮT BUỘC:
1. `folder_name`: BẮT BUỘC dựa trên Tiêu đề THỰC TẾ của Video: "{video_title}". 
   KHÔNG ĐƯỢC tự đặt tên chung chung như "Tóm tắt YouTube", "Tìm hiểu về YouTube"!
2. Phụ đề tự động (auto-generated) CÓ THỂ CHỨA LỖI - đặc biệt 30-60 giây đầu. HÃY:
   - Bỏ qua các đoạn văn không liên quan/không có ngữ cảnh
   - Tập trung vào các đoạn có thuật ngữ chuyên ngành khớp với tiêu đề video
   - Ưu tiên Tiêu đề Video và Tên Kênh ({author_name or 'N/A'}) làm nguồn tham chiếu chính
3. Mỗi bài học có tiêu đề rõ ràng, thực tế và tóm tắt 1-2 câu.

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
            data["video_id"] = video_id
            data["transcript"] = format_transcript_for_linking(transcript)
            return data
        except Exception:
            return {
                "folder_name": video_title or "Lộ trình từ Video YouTube",
                "has_transcript": has_transcript,
                "video_title": video_title,
                "video_id": video_id,
                "transcript": format_transcript_for_linking(transcript),
                "lessons": [
                    {"title": f"Bài 1: {video_title or 'Tổng quan nội dung'}", "summary": "Nội dung phân tích từ video YouTube."}
                ]
            }