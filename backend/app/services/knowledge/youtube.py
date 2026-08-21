import json
import asyncio
from google import genai
from google.genai import types
from app.core.config import settings

# 1. Initialize Client
api_key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None)
client = genai.Client(api_key=api_key)
MODEL_NAME = "gemini-3.5-flash"  # Supports direct YouTube URI processing

class YouTubeNativeService:
    @classmethod
    async def extract_outline_from_youtube_url(cls, youtube_url: str) -> dict:
        prompt = f"""
        Analyze the content of this YouTube video and generate a structured outline for an educational roadmap.
        Return strictly JSON with this format:
        {{
          "folder_name": "Folder Title Based on Video",
          "lessons": [
            {{"title": "Lesson 1: Title", "summary": "1-2 sentence summary"}},
            {{"title": "Lesson 2: Title", "summary": "1-2 sentence summary"}}
          ]
        }}
        """

        # Pass YouTube link directly as a URI Part
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=[
                types.Part.from_uri(
                    file_uri=youtube_url,
                    mime_type="video/mp4",
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        raw_json = response.text or "{}"
        return json.loads(raw_json)