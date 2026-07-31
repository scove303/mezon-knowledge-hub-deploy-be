from tavily import AsyncTavilyClient
from app.core.config import settings


async def tavily_search(query: str) -> str:

    client = AsyncTavilyClient(settings.TAVILY_API_KEY)
    response = await client.search(
        query=query,
        search_depth="advanced",
        include_answer="advanced",
    )


    results = response.get("results", [])
    context = "\n\n".join([f"- Nguồn ({r['title']}): {r['content']}" for r in results])

    return context

