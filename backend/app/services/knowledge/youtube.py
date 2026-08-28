# -*- coding: utf-8 -*-
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


def extract_video_id(url):
    """Extracts 11-char video ID from YouTube URL."""
    match = re.search(r"(?:v=|\/)([a-zA-Z0-9_-]{11})", url)
    if match:
        return match.group(1)
    raise ValueError("Khong the tim thay Video ID hop le tu URL: " + url)


def get_youtube_video_info(youtube_url):
    """Get video title & author name via YouTube oEmbed API."""
    try:
        oembed_url = "https://www.youtube.com/oembed?url=" + youtube_url + "&format=json"
        req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return {
                "title": data.get("title", ""),
                "author_name": data.get("author_name", "")
            }
    except Exception as e:
        print("[YouTube oEmbed error]:", e)
    return {}


async def get_transcript_from_transcriptapi(video_id):
    """Fetch transcript from TranscriptAPI.com - more reliable than youtube_transcript_api."""
    try:
        url = TRANSCRIPT_API_BASE + "/transcript"
        headers = {
            "Authorization": "Bearer " + TRANSCRIPT_API_KEY,
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
                    print("[TranscriptAPI error " + str(resp.status) + "]: " + error_text)
    except Exception as e:
        print("[TranscriptAPI error for " + video_id + "]:", e)
    return []


def get_youtube_transcript(video_id):
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
        print("[YouTube transcript unavailable for " + video_id + "]:", e)
    return []


async def get_transcript_from_supadata(video_id):
    """Fetch transcript from Supadata.ai REST API."""
    if not SUPADATA_API_KEY:
        print("[Supadata] No API key configured, skipping")
        return []

    url = SUPADATA_API_BASE + "/youtube/transcript"
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
                    content = data.get("content", [])
                    if content:
                        print("[Supadata] Got " + str(len(content)) + " segments")
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
                    print("[Supadata] No transcript available for video_id=" + video_id)
                    return []
                else:
                    error_text = await resp.text()
                    print("[Supadata] Error " + str(resp.status) + ": " + error_text[:200])
                    return []
    except Exception as e:
        print("[Supadata] Error:", e)
        return []


async def get_best_transcript(video_id):
    """Try Supadata.ai first (REST API, works on cloud IPs), then TranscriptAPI, fallback to youtube_transcript_api."""
    # 1. Try Supadata.ai first (REST API, works on cloud IPs)
    transcript = await get_transcript_from_supadata(video_id)
    if transcript:
        print("[Transcript] Got " + str(len(transcript)) + " segments from Supadata.ai")
        return transcript

    # 2. Try TranscriptAPI.com (MCP - may not work as REST)
    transcript = await get_transcript_from_transcriptapi(video_id)
    if transcript:
        print("[Transcript] Got " + str(len(transcript)) + " segments from TranscriptAPI.com")
        return transcript

    # 3. Fallback to youtube_transcript_api (IP blocked on cloud)
    transcript = get_youtube_transcript(video_id)
    if transcript:
        print("[Transcript] Got " + str(len(transcript)) + " segments from youtube_transcript_api (fallback)")
    else:
        print("[Transcript] WARNING: No transcript available for video_id=" + video_id + " (IP blocked or no captions)")
    return transcript


def format_transcript_for_context(transcript, max_chars=12000):
    """Format transcript with timestamps [MM:SS] for AI context."""
    if not transcript:
        return ""
    lines = []
    for item in transcript:
        start_sec = int(item.get('start', 0))
        minutes = start_sec // 60
        seconds = start_sec % 60
        timestamp = "[" + str(minutes).zfill(2) + ":" + str(seconds).zfill(2) + "]"
        lines.append(timestamp + " " + item.get('text', ''))
    result = "\n".join(lines)
    return result[:max_chars]


def format_transcript_for_linking(transcript):
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
    def extract_video_id(cls, url):
        """Extracts 11-char video ID from YouTube URL."""
        match = re.search(r"(?:v=|\/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
        raise ValueError("Khong the tim thay Video ID hop le tu URL: " + url)

    @classmethod
    def fetch_video_metadata(cls, youtube_url):
        """Fallback: Lay Tieu de, Mo ta va Tags khi video khong co Phu de."""
        try:
            with YoutubeDL({'skip_download': True, 'quiet': True}) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                title = info.get('title', '')
                description = info.get('description', '')
                tags = ", ".join(info.get('tags', []) or [])
                return "Tieu de Video: " + title + "\n\nMo ta Video:\n" + description + "\n\nTu khoa (Tags): " + tags
        except Exception as e:
            raise RuntimeError("Video khong co phu de va khong the lay thong tin chi tiet: " + str(e))

    @classmethod
    async def fetch_transcript_text(cls, video_id, youtube_url):
        """Thu lay phu de kèm mốc thời gian thông qua get_best_transcript."""
        raw_transcript = await get_best_transcript(video_id)
        if raw_transcript:
            return format_transcript_for_context(raw_transcript), raw_transcript
        
        # Fallback khi KHÔNG CÓ PHỤ ĐỀ: Lấy Metadata thông qua yt-dlp
        print("Video " + video_id + " khong co phu de. Chuyen sang lay thong tin Metadata...")
        metadata = cls.fetch_video_metadata(youtube_url)
        return metadata, []

    @classmethod
    async def get_roadmap_outline_from_transcript(cls, youtube_url):
        video_id = cls.extract_video_id(youtube_url)
        context_text, raw_transcript = await cls.fetch_transcript_text(video_id, youtube_url)

        prompt = f"""
        Dữ liệu dưới đây là Nội dung kèm mốc thời gian Timestamp [MM:SS] của một Video YouTube:

        ---
        {context_text[:30000]}
        ---

        Dựa trên nội dung có timestamp ở trên, hãy thiết kế một Cây Lộ Trình Học Tập gồm 6-10 bài học.
        Đối với mỗi bài học, hãy trích xuất mốc thời gian bắt đầu chính xác nhất dựa trên timestamp có trong dữ liệu (tính ra số giây `start_seconds`).

        Trả về DUY NHẤT định dạng JSON theo mẫu:
        {{
          "video_id": "{video_id}",
          "folder_name": "Tên Lộ Trình Học Tập Theo Chủ Đề Video",
          "lessons": [
            {{
              "lesson_key": "Bài 1",
              "title": "Bài 1: [Tên bài học]",
              "summary": "Tóm tắt 1-2 câu",
              "start_time": "00:01:15",
              "start_seconds": 75,
              "anchor_url": "https://www.youtube.com/watch?v={video_id}&t=75s"
            }},
            {{
              "lesson_key": "Bài 2",
              "title": "Bài 2: [Tên bài học]",
              "summary": "Tóm tắt 1-2 câu",
              "start_time": "00:05:40",
              "start_seconds": 340,
              "anchor_url": "https://www.youtube.com/watch?v={video_id}&t=340s"
            }}
          ]
        }}
        """

        # Wrap with retry for 503 errors
        async def generate_with_retry():
            retries = 8
            base_delay = 10.0
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
                    code = getattr(e, "code", None)
                    is_503 = code == 503 or "503" in str(e) or "UNAVAILABLE" in str(e)
                    if is_503:
                        print("[Gemini 503 Outline] Thu lai lan " + str(attempt + 1) + "/8 sau " + str(int(base_delay)) + "s...")
                        base_delay *= 1.5
                        await asyncio.sleep(base_delay)
                    else:
                        raise
            raise RuntimeError("Gemini Service Unavailable after retries.")

        response = await generate_with_retry()

        raw_json = response.text or "{}"
        outline_data = json.loads(raw_json)
        outline_data["video_id"] = video_id
        outline_data["has_transcript"] = bool(raw_transcript)
        outline_data["transcript"] = raw_transcript
        
        # Đảm bảo tất cả các bài học đều có link anchor_url chuẩn YouTube
        for lesson in outline_data.get("lessons", []):
            secs = lesson.get("start_seconds", 0)
            lesson["anchor_url"] = f"https://www.youtube.com/watch?v={video_id}&t={secs}s"

        return context_text, outline_data