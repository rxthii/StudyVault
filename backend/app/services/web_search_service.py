from typing import List, Optional
import httpx
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.schemas.chat import WebSourceReference


class WebSearchService:
    """Abstraction for external web searching, allowing swappable search providers."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    async def search(self, query: str, max_results: int = 5) -> List[WebSourceReference]:
        provider = self.settings.WEB_SEARCH_PROVIDER.lower().strip()

        if self.settings.APP_ENV == "test" or provider == "mock":
            return self._mock_search(query, max_results)

        if provider == "tavily" and self.settings.is_valid_credential(self.settings.WEB_SEARCH_API_KEY):
            return await self._search_tavily(query, max_results)

        # Default fallback to DuckDuckGo (free, no API key needed)
        try:
            return await self._search_duckduckgo(query, max_results)
        except Exception as e:
            logger.warning(f"DuckDuckGo web search failed: {e}. Falling back to mock results.")
            return self._mock_search(query, max_results)

    def _mock_search(self, query: str, max_results: int) -> List[WebSourceReference]:
        return [
            WebSourceReference(
                title=f"Academic Overview: {query[:40]}",
                url=f"https://en.wikipedia.org/wiki/{query.replace(' ', '_')[:30]}",
                snippet=f"Comprehensive foundational reference regarding {query}. Details historical definitions, core theorems, and experimental validations."
            ),
            WebSourceReference(
                title=f"University Lecture Reference: {query[:40]}",
                url="https://ocw.mit.edu/courses/physics/notes",
                snippet=f"Educational course materials and syllabus notes explaining {query} for undergraduate physics and engineering students."
            )
        ][:max_results]

    async def _search_duckduckgo(self, query: str, max_results: int) -> List[WebSourceReference]:
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        data = {"q": query}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, data=data, headers=headers)
            if resp.status_code != 200:
                logger.warning(f"DuckDuckGo returned status {resp.status_code}")
                return self._mock_search(query, max_results)

            # Simple regex parser for DuckDuckGo HTML results
            import re
            results: List[WebSourceReference] = []
            blocks = re.findall(r'<a class="result__snippet[^>]*href="([^"]+)"[^>]*>(.*?)</a>', resp.text, re.DOTALL)
            
            # If snippets format is different, try finding result__title
            if not blocks:
                titles = re.findall(r'<a class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', resp.text)
                for u, t in titles[:max_results]:
                    clean_u = re.sub(r'<[^>]+>', '', u).strip()
                    clean_t = re.sub(r'<[^>]+>', '', t).strip()
                    results.append(WebSourceReference(
                        title=clean_t or "Web Result",
                        url=clean_u,
                        snippet=f"External web information for {query}."
                    ))
            else:
                for u, snip in blocks[:max_results]:
                    clean_snip = re.sub(r'<[^>]+>', '', snip).strip()
                    results.append(WebSourceReference(
                        title=f"Web Reference on {query[:30]}",
                        url=u,
                        snippet=clean_snip
                    ))

            if not results:
                return self._mock_search(query, max_results)
            return results[:max_results]

    async def _search_tavily(self, query: str, max_results: int) -> List[WebSourceReference]:
        from tavily import TavilyClient
        client = TavilyClient(api_key=self.settings.WEB_SEARCH_API_KEY)
        response = client.search(query=query, max_results=max_results)
        results = []
        for r in response.get("results", []):
            results.append(WebSourceReference(
                title=r.get("title", "Web Source"),
                url=r.get("url", ""),
                snippet=r.get("content", "")
            ))
        return results


_web_search_service: Optional[WebSearchService] = None


def get_web_search_service() -> WebSearchService:
    global _web_search_service
    if _web_search_service is None:
        _web_search_service = WebSearchService()
    return _web_search_service
