from document.parser import *
from search.tavily import *


async def roadmap_service(topic: str):
    tavilyContext = await tavily_search(topic)
    roadmapData = await parse_context_to_structure(topic,tavilyContext)
    

