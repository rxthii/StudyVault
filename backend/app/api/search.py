from fastapi import APIRouter
from app.schemas.search import WebSearchRequest, WebSearchResponse
from app.services.web_search_service import get_web_search_service

router = APIRouter(prefix="/search", tags=["Web Search"])


@router.post(
    "/web",
    response_model=WebSearchResponse,
    summary="External Web Search"
)
async def perform_web_search(
    payload: WebSearchRequest
):
    """
    Search external web sources. Consumed by the RAG engine when external knowledge is allowed.
    """
    web_svc = get_web_search_service()
    results = await web_svc.search(query=payload.query, max_results=5)
    return WebSearchResponse(
        query=payload.query,
        provider=web_svc.settings.WEB_SEARCH_PROVIDER,
        results=results,
        count=len(results)
    )
