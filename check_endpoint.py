import aiohttp
import asyncio
import sys
import os

async def test_endpoint(url, params, api_key):
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            print(f'Status: {resp.status}')
            if resp.status == 200:
                data = await resp.json()
                print(f'Success! Keys: {list(data.keys())}')
                if 'content' in data:
                    print(f'Segments: {len(data["content"])}')
                    if data['content']:
                        print(f'First segment: {data["content"][0]}')
            else:
                error = await resp.text()
                print(f'Error {resp.status}: {error[:200]}')

async def main():
    api_key = os.getenv('SUPADATA_API_KEY') or sys.argv[1] if len(sys.argv) > 1 else 'your_key_here'
    video_id = sys.argv[2] if len(sys.argv) > 2 else '1nRj4ALuw7A'
    
    if not api_key or api_key == 'your_key_here':
        print('Please set SUPADATA_API_KEY environment variable or pass as first argument')
        print('Usage: python check_endpoint.py <api_key> [video_id]')
        return
    
    endpoints = [
        ('/v1/youtube/transcript', {'video_id': video_id, 'lang': 'en'}),
        ('/v1/youtube/transcript', {'video_id': video_id}),
        ('/v1/transcript', {'video_id': video_id}),
        ('/transcript', {'video_id': video_id}),
    ]
    
    async with aiohttp.ClientSession() as session:
        for endpoint, params in endpoints:
            url = f'https://api.supadata.ai{endpoint}'
            print(f'\nTesting: {url}')
            await test_endpoint(url, params, api_key)

asyncio.run(main())