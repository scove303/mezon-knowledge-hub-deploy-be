import sys
sys.path.insert(0, '.')
from app.services.knowledge.youtube import extract_youtube_video_id, get_best_transcript
import asyncio

url = 'https://www.youtube.com/watch?v=1nRj4ALuw7A'
video_id = extract_youtube_video_id(url)
print('Video ID:', video_id)

async def test():
    transcript = await get_best_transcript(video_id)
    print('Transcript segments:', len(transcript))
    if transcript:
        for item in transcript[:3]:
            text = item['text'][:60]
            print('  {:.1f}s: {}'.format(item['start'], text))

asyncio.run(test())