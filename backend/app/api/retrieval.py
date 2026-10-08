from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.retrieval import (
    RetrievalRequest,
    RetrievalResult,
    RetrievalStatsResponse,
)
from app.services.retrieval_service import RetrievalService

router = APIRouter(prefix="/retrieval", tags=["Retrieval"])


@router.post(
    "/search",
    response_model=RetrievalResult,
    summary="Semantic Vector Retrieval"
)
def search_documents(
    payload: RetrievalRequest,
    db: Session = Depends(get_db)
):
    """
    Execute semantic vector search against Pinecone with active-document boundaries.
    Returns the top relevant chunks, document metadata, page numbers, and similarity scores.
    """
    retrieval_svc = RetrievalService(db)
    return retrieval_svc.search(
        query=payload.query,
        document_ids=payload.document_ids,
        top_k=payload.top_k
    )


@router.get(
    "/stats",
    response_model=RetrievalStatsResponse,
    summary="Vector Index & Retrieval Statistics"
)
def get_retrieval_stats(
    db: Session = Depends(get_db)
):
    """
    Returns retrieval and index statistics including total vector count, dimensions,
    active linked documents, and namespaces.
    """
    retrieval_svc = RetrievalService(db)
    return retrieval_svc.get_stats()
