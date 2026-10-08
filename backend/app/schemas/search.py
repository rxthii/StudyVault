from typing import List, Optional
from pydantic import BaseModel, Field
from .chat import WebSourceReference


class WebSearchRequest(BaseModel):
    query: str = Field(..., description="Query for external web search")
    document_ids: Optional[List[str]] = Field(default=[], description="Optional document IDs for contextual relevance")


class WebSearchResponse(BaseModel):
    query: str
    provider: str
    results: List[WebSourceReference]
    count: int
