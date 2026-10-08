from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.document import PageContentResponse
from app.services.document_service import DocumentService

router = APIRouter(tags=["Sources & Evidence"])


@router.get(
    "/sources/{document_id}/{chunk_id}",
    summary="Get Source Chunk Snippet"
)
def get_source_chunk(
    document_id: str,
    chunk_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve exact snippet text and metadata for a referenced source chunk.
    Guarantees full traceability from AI responses back to the source document.
    """
    svc = DocumentService(db)
    return svc.get_chunk_snippet(document_id, chunk_id)


@router.get(
    "/documents/{document_id}/page/{page_number}",
    response_model=PageContentResponse,
    summary="Get Page Content"
)
def get_page_content(
    document_id: str,
    page_number: int,
    db: Session = Depends(get_db)
):
    """
    Retrieve text passages extracted from a specific page of an uploaded document.
    Does NOT expose arbitrary internal filesystem paths.
    """
    svc = DocumentService(db)
    return svc.get_page_content(document_id, page_number)
