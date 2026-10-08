from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class SourceReference(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: str = Field(..., description="Unique ID of source document")
    filename: str = Field(..., description="Display name of source document")
    page_number: int = Field(1, description="Page number where available (1 for TXT)")
    chunk_id: str = Field(..., description="Unique ID of chunk")
    relevance_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    snippet: str = Field(..., description="Exact extracted passage from document")


class RetrievalRequest(BaseModel):
    query: str = Field(..., description="Search query or question")
    document_ids: Optional[List[str]] = Field(
        default=None,
        examples=[None],
        description="Optional list of document IDs to restrict search to. Leave empty or null for all active linked documents."
    )
    top_k: int = Field(default=5, ge=1, le=20, description="Number of top chunks to retrieve (3-5 recommended)")


class RetrievalResult(BaseModel):
    query: str
    results: List[SourceReference]
    total_found: int
    active_documents_count: int


class RetrievalStatsResponse(BaseModel):
    index_name: str
    dimension: int
    total_vector_count: int
    namespaces: Dict[str, Any]
    linked_documents_count: int
    total_documents_count: int
