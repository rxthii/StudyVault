from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.document import (
    Document as DocumentSchema,
    DocumentUploadResponse,
    DocumentUploadItem,
    LinkDocumentRequest,
    LinkDocumentResponse,
    DocumentContentResponse,
)
from app.schemas.common import BaseMessageResponse
from app.services.document_service import DocumentService
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Documents"
)
async def upload_documents(
    files: List[UploadFile] = File(..., description="One or multiple PDF and TXT files"),
    db: Session = Depends(get_db)
):
    """
    Upload one or multiple PDF/TXT study documents.
    Executes validation, text extraction, chunking, embedding generation, Pinecone indexing,
    and database persistence.
    """
    ingestion_svc = IngestionService(db)
    uploaded_items: List[DocumentUploadItem] = []
    success_count = 0
    fail_count = 0

    for f in files:
        try:
            doc = await ingestion_svc.process_file(f)
            uploaded_items.append(DocumentUploadItem(
                document_id=doc.id,
                filename=doc.filename,
                status=doc.status,
                file_size=doc.file_size
            ))
            success_count += 1
        except Exception as e:
            fail_count += 1
            uploaded_items.append(DocumentUploadItem(
                document_id="error",
                filename=f.filename or "unknown",
                status="failed",
                file_size=0,
                error_message=str(e)
            ))

    message = f"Successfully uploaded {success_count} documents."
    if fail_count > 0:
        message += f" ({fail_count} files failed processing)."

    return DocumentUploadResponse(
        message=message,
        documents=uploaded_items,
        uploaded_count=success_count,
        failed_count=fail_count
    )


@router.get(
    "",
    response_model=List[DocumentSchema],
    summary="List Documents"
)
def list_documents(
    linked: Optional[bool] = Query(None, description="Filter by linked (active) status"),
    status: Optional[str] = Query(None, description="Filter by processing status: ready, processing, failed"),
    db: Session = Depends(get_db)
):
    """
    List all uploaded documents in the user's library with optional filters.
    """
    doc_svc = DocumentService(db)
    docs = doc_svc.list_documents(linked=linked, status=status)
    results = []
    for d in docs:
        schema_doc = DocumentSchema.model_validate(d)
        schema_doc.chunk_count = len(d.chunks)
        results.append(schema_doc)
    return results


@router.get(
    "/{document_id}",
    response_model=DocumentSchema,
    summary="Get Document Details"
)
def get_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve document metadata, processing status, and linked state.
    """
    doc_svc = DocumentService(db)
    doc = doc_svc.get_document(document_id)
    schema_doc = DocumentSchema.model_validate(doc)
    schema_doc.chunk_count = len(doc.chunks)
    return schema_doc


@router.get(
    "/{document_id}/content",
    response_model=DocumentContentResponse,
    summary="Get Document Content"
)
def get_document_content(
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve extracted text chunks and content structure for an indexed document.
    """
    doc_svc = DocumentService(db)
    return doc_svc.get_document_content(document_id)


@router.patch(
    "/{document_id}/link",
    response_model=LinkDocumentResponse,
    summary="Link or Unlink Document"
)
def link_document(
    document_id: str,
    payload: LinkDocumentRequest,
    db: Session = Depends(get_db)
):
    """
    Link or temporarily unlink a document from the active retrieval scope.
    Unlinking excludes the document from search without deleting its vector embeddings.
    """
    doc_svc = DocumentService(db)
    doc = doc_svc.set_link_status(document_id, payload.linked)
    state_str = "linked to active knowledge" if payload.linked else "unlinked from active retrieval"
    return LinkDocumentResponse(
        document_id=doc.id,
        linked=doc.linked,
        message=f"Document '{doc.filename}' successfully {state_str}."
    )


@router.delete(
    "/{document_id}",
    response_model=BaseMessageResponse,
    summary="Delete Document"
)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    Permanently delete document, associated SQLite chunks, and Pinecone vector embeddings.
    """
    doc_svc = DocumentService(db)
    doc_svc.delete_document(document_id)
    return BaseMessageResponse(
        message=f"Document '{document_id}' and all associated vector embeddings have been deleted permanently."
    )
