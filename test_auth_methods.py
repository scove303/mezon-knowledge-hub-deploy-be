import aiohttp
import asyncio

async def test():
    url = 'https://api.supadata.ai/v1/youtube/transcript'
    video_id = '1nRj4ALuw7A'
    
    methods = [
        # Method 1: Bearer in header
        {'headers': {'Authorization': 'Bearer sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'video_id': video_id, 'lang': 'en'}},
        # Method 2: x-api-key in header
        {'headers': {'x-api-key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'video_id': video_id, 'lang': 'en'}},
        # Method 3: api_key in query
        {'headers': {}, 'params': {'video_id': video_id, 'lang': 'en', 'api_key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}},
        # Method 4: key without sd_ prefix
        {'headers': {'Authorization': 'Bearer a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'video_id': video_id, 'lang': 'en'}},
    ]
    
    async with aiohttp.ClientSession() as session:
        for i, method in enumerate(methods):
            print(f'\nTrying method {i+1}:')
            try:
                async with session.get(url, headers=method.get('headers', {}), params=method.get('params', {}), timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    print(f'  Status: {resp.status}')
                    if resp.status == 200:
                        data = await resp.json()
                        print(f'  Success! Keys: {list(data.keys())}')
                        if 'content' in data:
                            print(f'  Segments: {len(data["content"])}')
                            return
                    else:
                        error = await resp.text()
                        print(f'  Error: {error[:200]}')
            except Exception as e:
                print(f'  Exception: {e}')

asyncio.run(test())