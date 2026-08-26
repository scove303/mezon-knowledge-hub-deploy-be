import aiohttp
import asyncio

async def test():
    url = 'https://api.supadata.ai/v1/youtube/transcript'
    video_id = '1nRj4ALuw7A'
    api_key = 'sd_a1c7ef285bd70991e7c84e3529d912af'
    
    # Test different parameter names based on the error message
    methods = [
        # Method 1: x-api-key with 'id' (from error message)
        {'headers': {'x-api-key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'id': '1nRj4ALuw7A', 'lang': 'en'}},
        # Method 2: x-api-key with 'videoId' (from error message)
        {'headers': {'x-api-key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'videoId': '1nRj4ALuw7A', 'lang': 'en'}},
        # Method 3: x-api-key with 'url'
        {'headers': {'x-api-key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'url': 'https://www.youtube.com/watch?v=1nRj4ALuw7A', 'lang': 'en'}},
        # Method 4: x-api-key with 'video_id' (snake_case)
        {'headers': {'x-api-key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'video_id': '1nRj4ALuw7A', 'lang': 'en'}},
        # Method 5: Bearer with x-api-key and correct param
        {'headers': {'Authorization': 'Bearer sd_a1c7ef285bd70991e7c84e3529d912af', 'x-api-key': 'sd_a1c7ef285bd70991e7c84e3529d912af'}, 'params': {'id': '1nRj4ALuw7A', 'lang': 'en'}},
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
                            if data['content']:
                                print(f'First: {data["content"][0]}')
                            return
                    else:
                        error = await resp.text()
                        print(f'  Error: {error[:300]}')
            except Exception as e:
                print(f'  Exception: {e}')

asyncio.run(test())