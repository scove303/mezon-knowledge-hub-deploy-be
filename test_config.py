import sys
sys.path.insert(0, '.')
from app.services.knowledge.youtube import extract_youtube_video_id, get_youtube_video_info, get_best_transcript
import asyncio

url = 'https://www.youtube.com/watch?v=Ar9eIn4z6XE&list=RDbOynl5YGsUo&start_radio=1&t=2301s'
video_id = extract_youtube_video_id(url)
print('Video ID:', video_id)

info = get_youtube_video_info(url)
print('Title:', info.get('title'))
print('Author:', info.get('author_name'))

async def test_transcript():
    transcript = await get_best_transcript(video_id)
    print('Transcript segments:', len(transcript))
    if transcript:
        for item in transcript[:3]:
            text = item['text'][:60]
            print(f'  {item["start"]:.1f}s: {text}')

asyncio.run(test_transcript())