from tavily import AsyncTavilyClient
import os
from dotenv import load_dotenv

load_dotenv()



async def tavily_search(query: str) -> str:

    client = AsyncTavilyClient(os.getenv("TAVILY_API"))
    response = client.search(
        query=query,
        search_depth="advanced",
        include_answer="advanced",
    )


    results = response.get("results", [])
    context = "\n\n".join([f"- Nguồn ({r['title']}): {r['content']}" for r in results])

    return context

